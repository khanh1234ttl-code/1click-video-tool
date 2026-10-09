//! MCP server (stdio, JSON-RPC 2.0, one message per line) started as `<app> --mcp` by an agent.
//! Every tool is forwarded to the running app's control port (`control.rs`).

use futures_util::future::BoxFuture;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

const PROTOCOL: &str = "2025-06-18";
const NOT_RUNNING: &str = "Không kết nối được 1Click Video Tool. Hãy mở 1Click Video Tool trên máy này trước, rồi thử lại.";

/// Where tool calls go: the running app's control port (a fake in tests).
pub trait Control: Send {
    fn call<'a>(&'a mut self, method: &'a str, params: Value) -> BoxFuture<'a, Result<Value, String>>;
}

fn tool(name: &str, description: &str, properties: Value, required: &[&str]) -> Value {
    json!({ "name": name, "description": description, "inputSchema": { "type": "object", "properties": properties, "required": required } })
}

fn str_list(description: &str) -> Value {
    json!({ "type": "array", "items": { "type": "string" }, "description": description })
}

fn stt_list(description: &str) -> Value {
    json!({ "type": "array", "items": { "type": "integer" }, "description": description })
}

/// The tools an agent sees. Names and parameters match `control::dispatch`.
pub fn tools() -> Vec<Value> {
    let none = json!({});
    vec![
        tool("status", "Trạng thái 1Click Video Tool: extension Vids đã kết nối chưa, có FFmpeg không, đang chạy không, tóm tắt dự án đang mở.", none.clone(), &[]),
        tool("open_project", "Mở một folder ảnh làm dự án (folder là kho ảnh; lần đầu mỗi ảnh thành một dòng prompt).", json!({ "folder": { "type": "string", "description": "Đường dẫn tuyệt đối tới folder ảnh" } }), &["folder"]),
        tool("get_project", "Xem toàn bộ dự án: các dòng (STT, ảnh, prompt, text, nhạc, trạng thái, file đầu ra) và thiết lập.", none.clone(), &[]),
        tool("list_images", "Liệt kê tên ảnh trong folder ảnh của dự án (kho ảnh để gán cho prompt).", none.clone(), &[]),
        tool("add_prompts", "Thêm một dòng cho mỗi prompt. 'images' (tên ảnh trong kho) dùng chung cho mọi dòng mới, ví dụ 2 ảnh tham chiếu cho 10 prompt. 'texts' là chữ trên video theo thứ tự.", json!({ "prompts": str_list("Các prompt (nên viết tiếng Anh)"), "images": str_list("Tên ảnh trong kho, dùng chung cho các dòng mới"), "texts": str_list("Chữ trên video cho từng dòng mới, theo thứ tự") }), &["prompts"]),
        tool("update_rows", "Sửa từng dòng: prompt, text, images (danh sách tên ảnh), music (tên file trong folder nhạc, chuỗi rỗng = nhạc tự động). Chỉ trường nào có mới được sửa.", json!({ "rows": { "type": "array", "items": { "type": "object", "properties": { "stt": { "type": "integer" }, "prompt": { "type": "string" }, "text": { "type": "string" }, "images": str_list("Tên ảnh"), "music": { "type": "string" } }, "required": ["stt"] } } }), &["rows"]),
        tool("delete_rows", "Xoá các dòng theo STT (dòng đang chạy được giữ lại). STT các dòng còn lại không đổi.", json!({ "stts": stt_list("STT cần xoá") }), &["stts"]),
        tool("assign_images", "Gán ảnh hàng loạt. rule: 'all' = mọi dòng chọn dùng cùng các ảnh; 'roundRobin' = mỗi dòng 1 ảnh lần lượt; 'onePerImage' = thêm 1 dòng mới cho mỗi ảnh. stts rỗng = mọi dòng.", json!({ "images": str_list("Tên ảnh trong kho, theo thứ tự"), "rule": { "type": "string", "enum": ["all", "roundRobin", "onePerImage"] }, "stts": stt_list("Dòng áp dụng (rỗng = tất cả)") }), &["images", "rule"]),
        tool("set_settings", "Đổi một phần thiết lập. gen: {mode: 'imageToVideo' (ảnh làm khung đầu, đúng 1 ảnh/dòng) | 'componentsToVideo' (ảnh tham chiếu, 1–10 ảnh/dòng), aspectRatio: '16:9'|'9:16', quality: '720p'|'1080p', concurrency 1–10, maxRetries 0–5, autoPostProcess}. text: kiểu chữ (fontSize, color, strokeWidth, x, y…). music: {folder, mode: random|sequential|assigned, musicVolume, originalVolume, fadeIn, fadeOut}. output: {folder, overwrite}. commonPrompt: prompt chung.", json!({ "gen": { "type": "object" }, "text": { "type": "object" }, "music": { "type": "object" }, "output": { "type": "object" }, "commonPrompt": { "type": "string" } }), &[]),
        tool("apply_text_template", "Đặt chữ trên video theo mẫu: {stt} = số thứ tự, {ten} = tên ảnh đầu tiên. stts rỗng = mọi dòng.", json!({ "template": { "type": "string" }, "stts": stt_list("Dòng áp dụng") }), &["template"]),
        tool("assign_music_in_order", "Gán nhạc lần lượt theo thứ tự file trong folder nhạc (hết bài thì quay vòng).", json!({ "stts": stt_list("Dòng áp dụng (rỗng = tất cả)") }), &[]),
        tool("import_table", "Nhập file Excel/CSV: mỗi dòng là 1 prompt theo thứ tự; cột anh (nhiều ảnh cách nhau bằng ;), prompt, text, nhac.", json!({ "path": { "type": "string", "description": "Đường dẫn file .xlsx hoặc .csv" } }), &["path"]),
        tool("start_generation", "Bắt đầu tạo video cho các dòng đang Chờ trên Google Vids. Mỗi video tốn một lượt Veo của tài khoản Google: chỉ gọi khi người dùng đã đồng ý.", none.clone(), &[]),
        tool("stop_generation", "Dừng: hủy các video đang tạo (dòng chưa xong về Chờ).", none.clone(), &[]),
        tool("retry_failed", "Thử lại các dòng lỗi (mặc định mọi dòng lỗi). Lỗi tạo/tải video sẽ tạo lại và tốn lượt Veo; lỗi hậu kỳ thì không.", json!({ "stts": stt_list("Dòng cần thử lại") }), &[]),
        tool("export_videos", "Xuất video: chèn chữ và nhạc vào video gốc đã tạo, ghi ra thư mục Output. Không tốn lượt Veo. stts rỗng = mọi dòng đã có video gốc.", json!({ "stts": stt_list("Dòng cần xuất") }), &[]),
        tool("wait_until_idle", "Chờ tới khi không còn dòng nào đang chạy (hoặc hết thời gian) rồi trả trạng thái các dòng.", json!({ "timeoutSeconds": { "type": "integer", "description": "Mặc định 600, tối đa 3600" } }), &[]),
        tool("open_vids_browser", "Mở trình duyệt Vids đi kèm (profile riêng, extension gắn sẵn) để đăng nhập Google.", none.clone(), &[]),
        tool("set_hide_chrome", "Ẩn (true) hoặc hiện (false) cửa sổ Chrome đang tạo video.", json!({ "hide": { "type": "boolean" } }), &["hide"]),
    ]
}

/// One JSON-RPC message in, at most one out (notifications get no reply).
pub async fn handle_message(ctl: &mut impl Control, msg: Value) -> Option<Value> {
    let id = msg.get("id").cloned()?;
    let method = msg.get("method").and_then(Value::as_str).unwrap_or_default();
    let params = msg.get("params").cloned().unwrap_or_else(|| json!({}));
    let result = match method {
        "initialize" => json!({
            "protocolVersion": params.get("protocolVersion").and_then(Value::as_str).unwrap_or(PROTOCOL),
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "1click-video-tool", "version": env!("CARGO_PKG_VERSION") },
            "instructions": "Điều khiển 1Click Video Tool đang mở trên máy: mở folder ảnh, thêm prompt và ảnh, chỉnh thiết lập, tạo video trên Google Vids (tốn lượt Veo — hỏi người dùng trước), chờ xong rồi xuất video có chữ và nhạc.",
        }),
        "ping" => json!({}),
        "tools/list" => json!({ "tools": tools() }),
        "tools/call" => {
            let name = params.get("name").and_then(Value::as_str).unwrap_or_default();
            let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            let outcome = if tools().iter().any(|t| t["name"] == name) { ctl.call(name, args).await } else { Err(format!("Không có tool {name}")) };
            match outcome {
                Ok(v) => json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&v).unwrap_or_default() }], "isError": false }),
                Err(e) => json!({ "content": [{ "type": "text", "text": e }], "isError": true }),
            }
        }
        _ => return Some(json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": format!("Method not found: {method}") } })),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

type Socket = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

/// Talks to the running app over its control port; connects on first use and after drops.
struct WsControl {
    token: Option<String>,
    socket: Option<Socket>,
    next_id: u64,
}

impl WsControl {
    async fn connect(&mut self) -> Result<&mut Socket, String> {
        if self.socket.is_none() {
            let token = match &self.token {
                Some(t) => t.clone(),
                None => crate::control::load_or_create_token(&crate::project::app_dir()).map_err(|_| NOT_RUNNING.to_string())?,
            };
            let mut req = format!("ws://{}", crate::control::CONTROL_ADDR).into_client_request().map_err(|e| e.to_string())?;
            req.headers_mut().insert("Authorization", format!("Bearer {token}").parse().map_err(|_| NOT_RUNNING.to_string())?);
            let (ws, _) = tokio_tungstenite::connect_async(req).await.map_err(|_| NOT_RUNNING.to_string())?;
            self.token = Some(token);
            self.socket = Some(ws);
        }
        Ok(self.socket.as_mut().expect("just connected"))
    }
}

impl Control for WsControl {
    fn call<'a>(&'a mut self, method: &'a str, params: Value) -> BoxFuture<'a, Result<Value, String>> {
        Box::pin(async move {
            self.next_id += 1;
            let id = self.next_id;
            let request = json!({ "id": id, "method": method, "params": params }).to_string();
            let ws = self.connect().await?;
            if ws.send(Message::Text(request.into())).await.is_err() {
                self.socket = None;
                return Err(NOT_RUNNING.into());
            }
            loop {
                match ws.next().await {
                    Some(Ok(Message::Text(t))) => {
                        let reply: Value = serde_json::from_str(&t).map_err(|e| e.to_string())?;
                        if reply["id"] != json!(id) {
                            continue;
                        }
                        return match reply.get("error").and_then(Value::as_str) {
                            Some(e) => Err(e.to_string()),
                            None => Ok(reply.get("result").cloned().unwrap_or(Value::Null)),
                        };
                    }
                    Some(Ok(_)) => continue,
                    _ => {
                        self.socket = None;
                        return Err(NOT_RUNNING.into());
                    }
                }
            }
        })
    }
}

/// `<app> --mcp`: serve MCP on stdin/stdout until the agent closes stdin.
pub async fn run_stdio() {
    let mut ctl = WsControl { token: None, socket: None, next_id: 0 };
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    let mut out = tokio::io::stdout();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        let reply = match serde_json::from_str::<Value>(&line) {
            Ok(msg) => handle_message(&mut ctl, msg).await,
            Err(_) => Some(json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32700, "message": "Parse error" } })),
        };
        if let Some(r) = reply {
            if out.write_all(format!("{r}\n").as_bytes()).await.is_err() || out.flush().await.is_err() {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct Fake {
        calls: Vec<(String, Value)>,
        fail: bool,
    }
    impl Control for Fake {
        fn call<'a>(&'a mut self, method: &'a str, params: Value) -> BoxFuture<'a, Result<Value, String>> {
            self.calls.push((method.to_string(), params));
            let fail = self.fail;
            Box::pin(async move { if fail { Err("Hãy mở 1Click Video Tool trước".into()) } else { Ok(json!({ "rows": 3 })) } })
        }
    }

    #[tokio::test]
    async fn speaks_mcp_and_forwards_tool_calls() {
        let mut ctl = Fake { calls: vec![], fail: false };
        let init = handle_message(&mut ctl, json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "t", "version": "1" } } })).await.unwrap();
        assert_eq!(init["id"], 1);
        assert_eq!(init["result"]["protocolVersion"], "2025-06-18");
        assert!(init["result"]["capabilities"]["tools"].is_object());
        assert!(handle_message(&mut ctl, json!({ "jsonrpc": "2.0", "method": "notifications/initialized" })).await.is_none());

        let list = handle_message(&mut ctl, json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" })).await.unwrap();
        let names: Vec<&str> = list["result"]["tools"].as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect();
        for n in ["status", "open_project", "get_project", "list_images", "add_prompts", "update_rows", "delete_rows", "assign_images", "set_settings", "apply_text_template", "assign_music_in_order", "import_table", "start_generation", "stop_generation", "retry_failed", "export_videos", "wait_until_idle", "open_vids_browser", "set_hide_chrome"] {
            assert!(names.contains(&n), "missing tool {n}");
        }
        for t in list["result"]["tools"].as_array().unwrap() {
            assert_eq!(t["inputSchema"]["type"], "object", "{}", t["name"]);
        }
        let start = list["result"]["tools"].as_array().unwrap().iter().find(|t| t["name"] == "start_generation").unwrap();
        assert!(start["description"].as_str().unwrap().contains("lượt Veo"), "quota warning");

        let call = handle_message(&mut ctl, json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "add_prompts", "arguments": { "prompts": ["a"] } } })).await.unwrap();
        assert_eq!(ctl.calls, vec![("add_prompts".to_string(), json!({ "prompts": ["a"] }))]);
        assert_eq!(call["result"]["isError"], false);
        assert!(call["result"]["content"][0]["text"].as_str().unwrap().contains("\"rows\": 3"));
    }

    #[tokio::test]
    async fn errors_are_reported_as_tool_errors_or_rpc_errors() {
        let mut ctl = Fake { calls: vec![], fail: true };
        let call = handle_message(&mut ctl, json!({ "jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": { "name": "status" } })).await.unwrap();
        assert_eq!(call["result"]["isError"], true);
        assert!(call["result"]["content"][0]["text"].as_str().unwrap().contains("Hãy mở 1Click Video Tool"));
        let unknown = handle_message(&mut ctl, json!({ "jsonrpc": "2.0", "id": 5, "method": "resources/list" })).await.unwrap();
        assert_eq!(unknown["error"]["code"], -32601);
        let bad_tool = handle_message(&mut ctl, json!({ "jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": { "name": "rm_rf" } })).await.unwrap();
        assert_eq!(bad_tool["result"]["isError"], true);
        assert_eq!(ctl.calls.len(), 1, "unknown tools are not forwarded");
    }
}
