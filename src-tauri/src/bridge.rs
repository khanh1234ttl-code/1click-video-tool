//! Localhost WebSocket link to the Chrome extension (the tool is the server).
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::http::StatusCode;
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSettings {
    pub mode: String,
    pub aspect_ratio: String,
    pub quality: String,
    pub concurrency: u8,
    pub max_retries: u8,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobItem {
    pub index: u32,
    pub prompt: String,
    pub image_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToExt {
    #[serde(rename = "image.put")]
    ImagePut { id: String, name: String, base64: String },
    #[serde(rename = "job.submit")]
    JobSubmit {
        #[serde(rename = "jobId")]
        job_id: String,
        settings: JobSettings,
        items: Vec<JobItem>,
    },
    #[serde(rename = "job.cancel")]
    JobCancel {
        #[serde(rename = "jobId")]
        job_id: String,
    },
    #[serde(rename = "job.query")]
    JobQuery {
        #[serde(rename = "jobId")]
        job_id: String,
    },
    #[serde(rename = "ping")]
    Ping,
    /// Ask for the bounds of the window that runs Google Vids.
    #[serde(rename = "window.query")]
    WindowQuery,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DoneItem {
    pub index: u32,
    pub file_path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FailedItem {
    pub index: u32,
    pub error: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FromExt {
    #[serde(rename = "hello")]
    Hello {
        #[serde(rename = "extVersion")]
        ext_version: String,
    },
    #[serde(rename = "job.accepted")]
    JobAccepted {
        #[serde(rename = "jobId")]
        job_id: String,
    },
    #[serde(rename = "job.rejected")]
    JobRejected {
        #[serde(rename = "jobId")]
        job_id: String,
        error: String,
    },
    #[serde(rename = "item.progress")]
    ItemProgress {
        #[serde(rename = "jobId")]
        job_id: String,
        index: u32,
        percent: u8,
    },
    #[serde(rename = "item.downloaded")]
    ItemDownloaded {
        #[serde(rename = "jobId")]
        job_id: String,
        index: u32,
        #[serde(rename = "filePath")]
        file_path: String,
    },
    #[serde(rename = "item.failed")]
    ItemFailed {
        #[serde(rename = "jobId")]
        job_id: String,
        index: u32,
        error: String,
    },
    #[serde(rename = "job.status")]
    JobStatus {
        #[serde(rename = "jobId")]
        job_id: String,
        known: bool,
        done: Vec<DoneItem>,
        failed: Vec<FailedItem>,
        pending: Vec<u32>,
    },
    #[serde(rename = "pong")]
    Pong,
    /// The window running Google Vids (its own window), in DIPs.
    #[serde(rename = "window.info")]
    WindowInfo {
        #[serde(rename = "windowId")]
        window_id: i64,
        left: i32,
        top: i32,
        width: i32,
        height: i32,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum BridgeEvent {
    Connected { ext_id: String },
    Disconnected,
    Message(FromExt),
}

pub fn extension_id_from_origin(origin: Option<&str>) -> Option<String> {
    let id = origin?.strip_prefix("chrome-extension://")?.trim_end_matches('/');
    (!id.is_empty() && id.chars().all(|c| c.is_ascii_lowercase())).then(|| id.to_string())
}

struct Inner {
    allowed: Mutex<Option<String>>,
    current: Mutex<Option<(u64, mpsc::UnboundedSender<Message>)>>,
    next_conn: AtomicU64,
}

#[derive(Clone)]
pub struct Bridge {
    inner: Arc<Inner>,
}

impl Bridge {
    fn empty(allowed: Option<String>) -> Bridge {
        Bridge { inner: Arc::new(Inner { allowed: Mutex::new(allowed), current: Mutex::new(None), next_conn: AtomicU64::new(1) }) }
    }

    /// A bridge that never connects (used when port 17890 is busy).
    pub fn offline() -> Bridge {
        Bridge::empty(None)
    }

    pub async fn start(listener: TcpListener, allowed: Option<String>) -> (Bridge, mpsc::UnboundedReceiver<BridgeEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let bridge = Bridge::empty(allowed);
        let b = bridge.clone();
        tokio::spawn(async move {
            loop {
                if let Ok((stream, _)) = listener.accept().await {
                    let (b2, tx2) = (b.clone(), tx.clone());
                    tokio::spawn(async move { b2.serve(stream, tx2).await });
                }
            }
        });
        (bridge, rx)
    }

    pub fn allowed_id(&self) -> Option<String> {
        self.inner.allowed.lock().unwrap().clone()
    }

    pub fn reset_allowed(&self) {
        *self.inner.allowed.lock().unwrap() = None;
    }

    pub fn is_connected(&self) -> bool {
        self.inner.current.lock().unwrap().is_some()
    }

    /// False when no extension is connected.
    pub fn send(&self, msg: &ToExt) -> bool {
        let json = serde_json::to_string(msg).expect("ToExt serializes");
        match &*self.inner.current.lock().unwrap() {
            Some((_, tx)) => tx.send(Message::Text(json.into())).is_ok(),
            None => false,
        }
    }

    async fn serve(&self, stream: TcpStream, events: mpsc::UnboundedSender<BridgeEvent>) {
        let mut ext_id: Option<String> = None;
        // Trust on first use is decided at handshake time under one lock, so two first
        // handshakes racing each other cannot both be accepted.
        let check = |req: &Request, resp: Response| -> Result<Response, ErrorResponse> {
            let origin = req.headers().get("origin").and_then(|v| v.to_str().ok());
            let id = extension_id_from_origin(origin);
            let trusted = id.as_ref().is_some_and(|id| self.inner.allowed.lock().unwrap().get_or_insert_with(|| id.clone()) == id);
            match id {
                Some(id) if trusted => {
                    ext_id = Some(id);
                    Ok(resp)
                }
                _ => {
                    let mut r = ErrorResponse::new(Some("forbidden".into()));
                    *r.status_mut() = StatusCode::FORBIDDEN;
                    Err(r)
                }
            }
        };
        let Ok(ws) = tokio_tungstenite::accept_hdr_async(stream, check).await else { return };
        let ext_id = ext_id.expect("set by the accepted handshake");

        let (mut sink, mut source) = ws.split();
        let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
        let conn = self.inner.next_conn.fetch_add(1, Ordering::SeqCst);
        *self.inner.current.lock().unwrap() = Some((conn, tx.clone()));
        let _ = events.send(BridgeEvent::Connected { ext_id });

        let writer = tokio::spawn(async move {
            while let Some(m) = rx.recv().await {
                if sink.send(m).await.is_err() {
                    break;
                }
            }
        });
        // Keeps the extension's service worker alive and detects dead links.
        let pinger = tokio::spawn(async move {
            let mut t = tokio::time::interval(Duration::from_secs(20));
            t.tick().await;
            loop {
                t.tick().await;
                if tx.send(Message::Text(r#"{"type":"ping"}"#.to_string().into())).is_err() {
                    break;
                }
            }
        });
        while let Some(Ok(msg)) = source.next().await {
            match msg {
                Message::Text(t) => {
                    if let Ok(m) = serde_json::from_str::<FromExt>(&t) {
                        let _ = events.send(BridgeEvent::Message(m));
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
        pinger.abort();
        writer.abort();
        let mut cur = self.inner.current.lock().unwrap();
        if cur.as_ref().map(|c| c.0) == Some(conn) {
            *cur = None;
            drop(cur);
            let _ = events.send(BridgeEvent::Disconnected);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::{SinkExt, StreamExt};
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;

    #[test]
    fn json_shapes_match_the_spec() {
        let m = ToExt::JobSubmit {
            job_id: "j1".into(),
            settings: JobSettings { mode: "imageToVideo".into(), aspect_ratio: "16:9".into(), quality: "720p".into(), concurrency: 3, max_retries: 2 },
            items: vec![JobItem { index: 1, prompt: "p".into(), image_id: "j1-1".into() }],
        };
        let v: serde_json::Value = serde_json::to_value(&m).unwrap();
        assert_eq!(v["type"], "job.submit");
        assert_eq!(v["jobId"], "j1");
        assert_eq!(v["settings"]["aspectRatio"], "16:9");
        assert_eq!(v["items"][0]["imageId"], "j1-1");
        assert_eq!(serde_json::to_string(&ToExt::Ping).unwrap(), r#"{"type":"ping"}"#);
        let d: FromExt = serde_json::from_str(r#"{"type":"item.downloaded","jobId":"j1","index":3,"filePath":"E:\\AFF cám\\THÁNG 10\\1ClickBridge\\j1\\003_x_a.mp4"}"#).unwrap();
        assert_eq!(d, FromExt::ItemDownloaded { job_id: "j1".into(), index: 3, file_path: "E:\\AFF cám\\THÁNG 10\\1ClickBridge\\j1\\003_x_a.mp4".into() });
    }

    #[test]
    fn window_messages_match_the_bridge() {
        let m: FromExt = serde_json::from_str(r#"{"type":"window.info","windowId":50,"left":-8,"top":0,"width":1200,"height":800}"#).unwrap();
        assert_eq!(m, FromExt::WindowInfo { window_id: 50, left: -8, top: 0, width: 1200, height: 800 });
        assert_eq!(serde_json::to_string(&ToExt::WindowQuery).unwrap(), r#"{"type":"window.query"}"#);
    }

    #[test]
    fn origin_parsing() {
        assert_eq!(extension_id_from_origin(Some("chrome-extension://bedjklgfehfcmlaldafbbdplgblpdpch")).as_deref(), Some("bedjklgfehfcmlaldafbbdplgblpdpch"));
        assert_eq!(extension_id_from_origin(Some("https://evil.example")), None);
        assert_eq!(extension_id_from_origin(None), None);
    }

    async fn connect(addr: std::net::SocketAddr, origin: Option<&str>) -> Result<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, ()> {
        let mut req = format!("ws://{addr}").into_client_request().unwrap();
        if let Some(o) = origin {
            req.headers_mut().insert("Origin", o.parse().unwrap());
        }
        tokio_tungstenite::connect_async(req).await.map(|(ws, _)| ws).map_err(|_| ())
    }

    #[tokio::test]
    async fn first_extension_is_trusted_and_messages_flow_both_ways() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (bridge, mut events) = Bridge::start(listener, None).await;
        let mut ws = connect(addr, Some("chrome-extension://abc")).await.unwrap();
        assert_eq!(events.recv().await.unwrap(), BridgeEvent::Connected { ext_id: "abc".into() });
        assert_eq!(bridge.allowed_id().as_deref(), Some("abc"));
        assert!(bridge.is_connected());

        ws.send(Message::Text(r#"{"type":"hello","extVersion":"1.1.10.0"}"#.into())).await.unwrap();
        assert_eq!(events.recv().await.unwrap(), BridgeEvent::Message(FromExt::Hello { ext_version: "1.1.10.0".into() }));
        ws.send(Message::Text("not json".into())).await.unwrap(); // ignored

        assert!(bridge.send(&ToExt::JobQuery { job_id: "j9".into() }));
        let got = ws.next().await.unwrap().unwrap().into_text().unwrap();
        assert_eq!(got.as_str(), r#"{"type":"job.query","jobId":"j9"}"#);

        drop(ws);
        assert_eq!(events.recv().await.unwrap(), BridgeEvent::Disconnected);
        assert!(!bridge.is_connected());
    }

    #[tokio::test]
    async fn concurrent_first_handshakes_trust_only_one_extension() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (bridge, _events) = Bridge::start(listener, None).await;
        // Both sockets are accepted while nothing is trusted yet; only then do their handshakes arrive.
        let first = TcpStream::connect(addr).await.unwrap();
        let second = TcpStream::connect(addr).await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
        let handshake = |stream: TcpStream, origin: &str| {
            let mut req = format!("ws://{addr}").into_client_request().unwrap();
            req.headers_mut().insert("Origin", origin.parse().unwrap());
            async move { tokio_tungstenite::client_async(req, stream).await.map(|(ws, _)| ws) }
        };
        let _trusted = handshake(first, "chrome-extension://abc").await.expect("first extension is trusted");
        assert!(handshake(second, "chrome-extension://zzz").await.is_err(), "a second extension must not slip in");
        assert_eq!(bridge.allowed_id().as_deref(), Some("abc"));
    }

    #[tokio::test]
    async fn other_origins_are_rejected() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (bridge, _events) = Bridge::start(listener, Some("abc".into())).await;
        assert!(connect(addr, Some("chrome-extension://zzz")).await.is_err());
        assert!(connect(addr, Some("https://docs.google.com")).await.is_err());
        assert!(connect(addr, None).await.is_err());
        assert!(!bridge.is_connected());
        assert!(!Bridge::offline().send(&ToExt::Ping));
    }
}
