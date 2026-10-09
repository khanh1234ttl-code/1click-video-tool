#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `--mcp`: an agent starts this to talk MCP over stdin/stdout (no window).
    if std::env::args().any(|a| a == "--mcp") {
        return oneclick_video_tool_lib::run_mcp();
    }
    oneclick_video_tool_lib::run()
}
