//! SSE / NDJSON buffer helpers: drain complete frames without O(n²) realloc.

/// Take every complete `\\n`-terminated line, leaving a partial line in `buffer`.
pub fn take_complete_lines(buffer: &mut String) -> Vec<String> {
    let mut lines = Vec::new();
    let mut consumed = 0usize;
    while let Some(rel) = buffer[consumed..].find('\n') {
        let end = consumed + rel;
        let line = buffer[consumed..end].trim_end_matches('\r').to_string();
        lines.push(line);
        consumed = end + 1;
    }
    if consumed > 0 {
        buffer.drain(..consumed);
    }
    lines
}

/// Take every complete `\\n\\n` SSE event frame.
pub fn take_complete_frames(buffer: &mut String) -> Vec<String> {
    let mut frames = Vec::new();
    let mut consumed = 0usize;
    while let Some(rel) = buffer[consumed..].find("\n\n") {
        let end = consumed + rel;
        frames.push(buffer[consumed..end].to_string());
        consumed = end + 2;
    }
    if consumed > 0 {
        buffer.drain(..consumed);
    }
    frames
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn take_complete_lines_leaves_partial() {
        let mut buf = String::from("a\nb\npartial");
        let lines = take_complete_lines(&mut buf);
        assert_eq!(lines, ["a", "b"]);
        assert_eq!(buf, "partial");
    }

    #[test]
    fn take_complete_frames_splits_on_blank_line() {
        let mut buf = String::from("data: 1\n\ndata: 2\n\ndata: 3");
        let frames = take_complete_frames(&mut buf);
        assert_eq!(frames, ["data: 1", "data: 2"]);
        assert_eq!(buf, "data: 3");
    }
}
