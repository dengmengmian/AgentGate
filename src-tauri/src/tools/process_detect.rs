//! Look up running processes by basename so the UI can warn users that the
//! client they just (re)configured is still alive in some terminal and needs
//! a restart to pick up the new config.
//!
//! Unix shells out to `pgrep -i -l <name>` (substring + case-insensitive,
//! basename-only). Windows shells out to `tasklist /FO CSV /NH` and matches
//! image names the same way. Either path returns an empty list when the
//! underlying tool is missing, so the caller treats it as "couldn't detect"
//! rather than failing the apply.

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq, specta::Type)]
pub struct RunningProcess {
    pub pid: u32,
    pub command: String,
}

/// Find processes whose basename matches any of `needles`. Unix passes each
/// needle to `pgrep`; Windows lists everything once via `tasklist` and
/// filters in-process. Results are merged and deduplicated by PID. Returns
/// an empty list whenever the underlying tool is missing or fails.
pub fn find_running(needles: &[&str]) -> Vec<RunningProcess> {
    #[cfg(unix)]
    {
        find_unix(needles)
    }
    #[cfg(windows)]
    {
        find_windows(needles)
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = needles;
        Vec::new()
    }
}

#[cfg(unix)]
fn find_unix(needles: &[&str]) -> Vec<RunningProcess> {
    use std::process::Command;

    let mut all: Vec<RunningProcess> = Vec::new();
    for name in needles {
        let needle = name.trim();
        if needle.is_empty() {
            continue;
        }
        let Ok(output) = Command::new("pgrep").args(["-i", "-l", needle]).output() else {
            continue;
        };
        if !output.status.success() {
            // pgrep returns 1 when nothing matches, which is the common case.
            // Anything else (binary missing, permission denied) we just skip.
            continue;
        }
        all.extend(parse_pgrep(&String::from_utf8_lossy(&output.stdout)));
    }

    // Drop the AgentGate process itself in case a needle accidentally
    // matched it (e.g. searching for "claude" near a misnamed binary).
    all.retain(|p| !is_self_process(&p.command));

    all.sort_by_key(|p| p.pid);
    all.dedup_by_key(|p| p.pid);
    all
}

/// Windows：跑一次 `tasklist /FO CSV /NH` 拿全量进程，再在本地按 needles
/// 过滤。tasklist 缺失或失败时返回空列表（按「没检测到」处理，不阻塞 apply）。
#[cfg(windows)]
fn find_windows(needles: &[&str]) -> Vec<RunningProcess> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    // CREATE_NO_WINDOW：GUI 进程下 spawn 控制台程序默认会弹黑窗，
    // 且弹窗抢焦点会触发前端 focus 刷新→再次探测，形成无限弹窗循环。
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let Ok(output) = Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }
    parse_tasklist_csv(&String::from_utf8_lossy(&output.stdout), needles)
}

// Windows 构建下只有 tasklist 路径会用到，门控掉避免 dead_code warning。
#[cfg(any(unix, test))]
fn parse_pgrep(output: &str) -> Vec<RunningProcess> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let mut parts = line.splitn(2, char::is_whitespace);
            let pid_str = parts.next()?;
            let command = parts.next()?.trim();
            let pid = pid_str.parse::<u32>().ok()?;
            Some(RunningProcess {
                pid,
                command: command.to_string(),
            })
        })
        .collect()
}

fn is_self_process(command: &str) -> bool {
    let lc = command.to_ascii_lowercase();
    lc.contains("agentgate")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KillCheck {
    Ok,
    InvalidPid,
    SelfProcess,
    NotFound,
}

/// Only PIDs we just listed for this client are killable. Never PID 0/1 or us.
pub fn kill_check(pid: u32, live: &[RunningProcess]) -> KillCheck {
    if pid <= 1 {
        return KillCheck::InvalidPid;
    }
    if pid == std::process::id() {
        return KillCheck::SelfProcess;
    }
    if !live.iter().any(|p| p.pid == pid) {
        return KillCheck::NotFound;
    }
    KillCheck::Ok
}

/// SIGTERM, then SIGKILL if still alive. Windows uses `taskkill /T /F`.
pub fn terminate(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        run_cmd("kill", &["-TERM", &pid.to_string()])?;
        std::thread::sleep(std::time::Duration::from_millis(400));
        if pid_alive(pid) {
            run_cmd("kill", &["-KILL", &pid.to_string()])?;
        }
        Ok(())
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let output = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
        if output.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = pid;
        Err("kill is not supported on this platform".to_string())
    }
}

#[cfg(unix)]
fn run_cmd(bin: &str, args: &[&str]) -> Result<(), String> {
    let output = std::process::Command::new(bin)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(err.trim().to_string())
    }
}

#[cfg(unix)]
fn pid_alive(pid: u32) -> bool {
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Windows：解析 `tasklist /FO CSV /NH` 的输出。每行形如
/// `"Codex.exe","1234","Console","1","123,456 K"`，取映像名 + PID。
/// 按 needles 大小写不敏感子串匹配映像名，过滤 AgentGate 自身，
/// 按 PID 排序去重——语义与 Unix 路径的 pgrep 流程对齐。
#[cfg(any(windows, test))]
fn parse_tasklist_csv(output: &str, needles: &[&str]) -> Vec<RunningProcess> {
    let needles: Vec<String> = needles
        .iter()
        .map(|n| n.trim().to_ascii_lowercase())
        .filter(|n| !n.is_empty())
        .collect();
    if needles.is_empty() {
        return Vec::new();
    }

    let mut all: Vec<RunningProcess> = output
        .lines()
        .filter_map(|line| {
            let fields = parse_csv_fields(line.trim());
            // 前两列固定是「映像名称」「PID」；非 CSV 的提示行（如
            // "信息: 没有运行的任务…"）解析不出两列或 PID 非数字，自然跳过。
            let image = fields.first()?;
            let pid = fields.get(1)?.parse::<u32>().ok()?;
            let image_lc = image.to_ascii_lowercase();
            if !needles.iter().any(|n| image_lc.contains(n.as_str())) {
                return None;
            }
            Some(RunningProcess {
                pid,
                command: image.clone(),
            })
        })
        .collect();

    // 与 Unix 路径同语义：过滤 AgentGate 自身，按 PID 排序去重。
    all.retain(|p| !is_self_process(&p.command));
    all.sort_by_key(|p| p.pid);
    all.dedup_by_key(|p| p.pid);
    all
}

/// 解析一行带引号的 CSV（tasklist /FO CSV 风格）：字段全部用双引号包裹，
/// 引号内可含逗号，`""` 表示转义的双引号。
#[cfg(any(windows, test))]
fn parse_csv_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut cur = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    // "" 转义为单个双引号
                    chars.next();
                    cur.push('"');
                } else {
                    in_quotes = false;
                }
            } else {
                cur.push(c);
            }
        } else {
            match c {
                '"' => in_quotes = true,
                ',' => {
                    fields.push(std::mem::take(&mut cur));
                }
                _ => cur.push(c),
            }
        }
    }
    if !cur.is_empty() || !fields.is_empty() {
        fields.push(cur);
    }
    fields
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_pgrep_typical_output() {
        let out = "12345 codex\n67890 Codex Helper\n";
        let parsed = parse_pgrep(out);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].pid, 12345);
        assert_eq!(parsed[0].command, "codex");
        assert_eq!(parsed[1].pid, 67890);
        assert_eq!(parsed[1].command, "Codex Helper");
    }

    #[test]
    fn parse_pgrep_handles_blank_lines() {
        let out = "\n12345 claude\n\n";
        let parsed = parse_pgrep(out);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].command, "claude");
    }

    #[test]
    fn parse_pgrep_rejects_non_numeric_pid() {
        let out = "abc claude\n12345 codex\n";
        let parsed = parse_pgrep(out);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].pid, 12345);
    }

    #[test]
    fn is_self_filters_agentgate_basename() {
        assert!(is_self_process("agentgate"));
        assert!(is_self_process("AgentGate"));
        assert!(!is_self_process("claude"));
        assert!(!is_self_process("codex"));
    }

    // ---- Windows tasklist CSV 解析（纯函数，macOS 上也可跑） ----

    #[test]
    fn csv_fields_basic_quoted_line() {
        let fields = parse_csv_fields(r#""Codex.exe","1234","Console","1","123,456 K""#);
        assert_eq!(
            fields,
            vec!["Codex.exe", "1234", "Console", "1", "123,456 K"]
        );
    }

    #[test]
    fn csv_fields_escaped_quote_inside_field() {
        let fields = parse_csv_fields(r#""a""b","2""#);
        assert_eq!(fields, vec![r#"a"b"#, "2"]);
    }

    #[test]
    fn tasklist_matches_needles_case_insensitive() {
        let out = concat!(
            "\"Codex.exe\",\"200\",\"Console\",\"1\",\"10,000 K\"\r\n",
            "\"notepad.exe\",\"300\",\"Console\",\"1\",\"1,000 K\"\r\n",
            "\"Claude.exe\",\"100\",\"Console\",\"1\",\"20,000 K\"\r\n",
        );
        let got = parse_tasklist_csv(out, &["codex", "CLAUDE"]);
        assert_eq!(got.len(), 2);
        // 按 PID 排序
        assert_eq!(got[0].pid, 100);
        assert_eq!(got[0].command, "Claude.exe");
        assert_eq!(got[1].pid, 200);
        assert_eq!(got[1].command, "Codex.exe");
    }

    #[test]
    fn tasklist_filters_agentgate_self() {
        let out = "\"AgentGate.exe\",\"42\",\"Console\",\"1\",\"5,000 K\"\r\n";
        assert!(parse_tasklist_csv(out, &["agentgate", "gate"]).is_empty());
    }

    #[test]
    fn tasklist_dedups_pid_matched_by_multiple_needles() {
        let out = "\"Codex.exe\",\"77\",\"Console\",\"1\",\"5,000 K\"\r\n";
        let got = parse_tasklist_csv(out, &["codex", "Codex.exe"]);
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].pid, 77);
    }

    #[test]
    fn tasklist_skips_garbage_and_blank_lines() {
        let out = concat!(
            "信息: 没有运行的任务匹配指定标准。\r\n",
            "\r\n",
            "\"Codex.exe\",\"notanumber\",\"Console\",\"1\",\"1 K\"\r\n",
            "\"Codex.exe\",\"88\",\"Console\",\"1\",\"1 K\"\r\n",
        );
        let got = parse_tasklist_csv(out, &["codex"]);
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].pid, 88);
    }

    #[test]
    fn tasklist_ignores_blank_needles() {
        let out = "\"Codex.exe\",\"88\",\"Console\",\"1\",\"1 K\"\r\n";
        assert!(parse_tasklist_csv(out, &["", "  "]).is_empty());
    }

    fn live(pid: u32, command: &str) -> RunningProcess {
        RunningProcess {
            pid,
            command: command.to_string(),
        }
    }

    #[test]
    fn kill_check_allows_pid_in_live_list() {
        assert_eq!(kill_check(4242, &[live(4242, "dsh")]), KillCheck::Ok);
    }

    #[test]
    fn kill_check_rejects_pid_zero_and_init() {
        let list = [live(1, "init")];
        assert_eq!(kill_check(0, &list), KillCheck::InvalidPid);
        assert_eq!(kill_check(1, &list), KillCheck::InvalidPid);
    }

    #[test]
    fn kill_check_rejects_self_and_missing() {
        let self_pid = std::process::id();
        assert_eq!(
            kill_check(self_pid, &[live(self_pid, "dsh")]),
            KillCheck::SelfProcess
        );
        assert_eq!(
            kill_check(999_999, &[live(4242, "dsh")]),
            KillCheck::NotFound
        );
    }
}
