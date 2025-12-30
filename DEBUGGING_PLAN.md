# MP4 Corruption Debugging Plan

## Root Cause Analysis

Based on the code review, the most likely causes for long video corruption are:

### 1. **Non-monotonic timestamps after complex audio filtering** (HIGH PROBABILITY)
   - **Issue**: The `addBleepSounds` function uses a complex filter chain with many bleeps (145+ in your example)
   - **Problem**: With many `adelay` operations and `amix` filters, timestamps can become non-monotonic
   - **Evidence needed**: Check FFmpeg stderr for "Non-monotonous DTS" or "Invalid timestamp" errors
   - **Fix**: Already implemented - using `-fflags +genpts` and `-avoid_negative_ts make_zero`

### 2. **Moov atom not properly written** (HIGH PROBABILITY)
   - **Issue**: `+faststart` flag might not work reliably when re-encoding long videos
   - **Problem**: The moov atom might be written at the end, making the file unplayable until fully downloaded
   - **Evidence needed**: Run `ffprobe -v error -show_format output.mp4` - if it fails, moov atom is missing/corrupt
   - **Fix**: Two-step process - create file first, then remux with `+faststart` to move moov atom

### 3. **File not fully finalized** (MEDIUM PROBABILITY)
   - **Issue**: File might be served before FFmpeg fully closes the file handle
   - **Problem**: MP4 container needs proper trailer/atoms written
   - **Evidence needed**: File size changes after "end" event, or file is smaller than expected
   - **Fix**: Wait for file size to stabilize before serving

### 4. **Variable frame rate handling** (LOW PROBABILITY)
   - **Issue**: Input video might have variable frame rate, causing sync issues
   - **Problem**: When remuxing, frame rate changes can cause timestamp issues
   - **Evidence needed**: Check `r_frame_rate` vs `avg_frame_rate` in ffprobe output
   - **Fix**: Using `-fflags +genpts` should handle this

## Implementation Changes

### Key Improvements:

1. **Hard verification after each step**
   - `verifyAndLog()` function runs `ffprobe` and logs key properties
   - Fails fast if any step produces invalid output
   - Compares input vs output properties

2. **Robust muxing approach**
   - **Step 1**: Combine video (copy if H.264) + audio (encode to AAC) with `+faststart`
   - **Step 2**: Remux with `-c:v copy -c:a copy -movflags +faststart` to ensure moov atom is at beginning
   - This two-step process is more reliable than trying to do it in one pass

3. **Error detection**
   - `runFFmpegCommand()` captures stderr and checks for:
     - "Non-monotonous DTS"
     - "Invalid argument"
     - "moov atom not found"
     - Any "Error" or "Failed" messages
   - Fails immediately if detected

4. **File stability checks**
   - Waits for file size to stabilize (3 consecutive checks with same size)
   - Ensures file is fully written before proceeding

5. **Atomic writes**
   - Writes to temp file first (`censored_temp_*.mp4`)
   - Only moves to final name after verification passes
   - Prevents serving incomplete files

## FFmpeg Commands Used

### Step 1: Combine Video + Audio
```bash
ffmpeg -i input.mp4 -i censored_audio.wav \
  -map 0:v:0 -map 1:a:0 \
  -c:v copy \                    # Copy video if H.264
  -c:a aac -b:a 192k -ar 44100 -ac 2 \
  -shortest \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  -movflags +faststart \
  -f mp4 -y temp_output.mp4
```

### Step 2: Final Remux (Move Moov Atom)
```bash
ffmpeg -i temp_output.mp4 \
  -c:v copy -c:a copy \
  -movflags +faststart \
  -f mp4 -y final_output.mp4
```

## Test Plan

### Prerequisites
- A 10-15 minute MP4 video file
- Server running with new code

### Test Steps

1. **Upload the long video** and process it

2. **Check server logs** for:
   - Each verification step (Step 1-9)
   - Input vs Output comparison
   - Any "Non-monotonous DTS" errors
   - File size stabilization messages

3. **Verify output file**:
   ```bash
   ffprobe -v error -show_format -show_streams output.mp4
   ```
   Should show:
   - Valid format
   - Video and audio streams
   - Correct duration matching input

4. **Test playback**:
   - Open in VLC
   - Open in QuickTime
   - Open in Chrome (via the web app)
   - Check: video plays, audio is in sync, duration is correct

5. **Check moov atom position**:
   ```bash
   # Moov atom should be near the beginning (first few KB)
   hexdump -C output.mp4 | head -20 | grep -i moov
   ```

### Expected Results

- ✅ All verification steps pass
- ✅ No "Non-monotonous DTS" errors in logs
- ✅ Output file is playable in all players
- ✅ Duration matches input (within 2 seconds tolerance)
- ✅ Audio is in sync
- ✅ File can be streamed (moov atom at beginning)

### If Still Failing

1. **Check FFmpeg stderr** for specific errors
2. **Compare input vs output properties** (duration, frame rate, etc.)
3. **Test with a shorter video** (1-2 minutes) to see if issue is duration-specific
4. **Check system resources** (disk space, memory) during processing

## Logs to Check

When a 10-minute file fails, look for:

1. **FFmpeg stderr output** - especially:
   - "Non-monotonous DTS"
   - "Invalid timestamp"
   - "moov atom not found"
   - Any "Error" messages

2. **Verification logs** - compare:
   - Input duration vs Output duration
   - Input frame rate vs Output frame rate
   - Input audio sample rate vs Output audio sample rate

3. **File size** - check if:
   - Temp file size vs Final file size (should be similar)
   - File size changes after "end" event

## Additional Safeguards Added

1. **Atomic file writes**: Write to temp, verify, then rename
2. **File stability checks**: Wait for file size to stabilize
3. **Hard error detection**: Fail immediately on timestamp errors
4. **Detailed logging**: Log all key properties at each step
5. **Two-step remuxing**: More reliable than single-pass

