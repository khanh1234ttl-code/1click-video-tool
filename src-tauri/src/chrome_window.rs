//! Hides or shows the Chrome window that runs Google Vids (Windows only). The bridge reports that
//! window's bounds in DIPs; the window is the top-level Chrome window whose rect matches them.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bounds {
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
}

/// Pixels of slack per edge: window frames and rounding differ slightly between Chrome and Win32.
const SLACK: i32 = 8;

/// Whether a window rect (left, top, right, bottom in physical pixels at `dpi`) is the window
/// the bridge reported in DIPs.
pub fn rect_matches(rect: (i32, i32, i32, i32), dpi: u32, b: &Bounds) -> bool {
    let scale = |v: i32| (v as f64 * dpi as f64 / 96.0).round() as i32;
    let want = (scale(b.left), scale(b.top), scale(b.left + b.width), scale(b.top + b.height));
    [(rect.0, want.0), (rect.1, want.1), (rect.2, want.2), (rect.3, want.3)].iter().all(|(a, w)| (a - w).abs() <= SLACK)
}

/// Shows or hides every top-level Chrome window matching `b`; returns how many matched.
#[cfg(windows)]
pub fn set_visible(b: &Bounds, visible: bool) -> usize {
    use windows_sys::Win32::Foundation::{HWND, LPARAM, RECT};
    use windows_sys::Win32::UI::HiDpi::GetDpiForWindow;
    use windows_sys::Win32::UI::WindowsAndMessaging::{EnumWindows, GetClassNameW, GetWindowRect, GetWindowTextLengthW, ShowWindow, SW_HIDE, SW_SHOWNOACTIVATE};

    struct Search {
        bounds: Bounds,
        found: Vec<HWND>,
    }
    unsafe extern "system" fn visit(hwnd: HWND, data: LPARAM) -> windows_sys::core::BOOL {
        let search = &mut *(data as *mut Search);
        let mut class = [0u16; 64];
        let n = GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32);
        if String::from_utf16_lossy(&class[..n.max(0) as usize]) != "Chrome_WidgetWin_1" || GetWindowTextLengthW(hwnd) == 0 {
            return 1;
        }
        let mut r: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut r) != 0 && rect_matches((r.left, r.top, r.right, r.bottom), GetDpiForWindow(hwnd).max(96), &search.bounds) {
            search.found.push(hwnd);
        }
        1
    }
    let mut search = Search { bounds: *b, found: vec![] };
    unsafe {
        EnumWindows(Some(visit), &mut search as *mut Search as LPARAM);
        for hwnd in &search.found {
            ShowWindow(*hwnd, if visible { SW_SHOWNOACTIVATE } else { SW_HIDE });
        }
    }
    search.found.len()
}

#[cfg(not(windows))]
pub fn set_visible(_b: &Bounds, _visible: bool) -> usize {
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    const B: Bounds = Bounds { left: 100, top: 80, width: 1200, height: 800 };

    #[test]
    fn matches_at_100_percent_scaling() {
        assert!(rect_matches((100, 80, 1300, 880), 96, &B));
        assert!(rect_matches((106, 74, 1294, 886), 96, &B), "a few pixels of frame are tolerated");
        assert!(!rect_matches((120, 80, 1320, 880), 96, &B), "another window 20px away is not it");
    }

    #[test]
    fn scales_dips_by_the_window_dpi() {
        assert!(rect_matches((150, 120, 1950, 1320), 144, &B));
        assert!(!rect_matches((100, 80, 1300, 880), 144, &B));
    }
}
