// src/native/media_probe/Program.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Media.Capture;
using Windows.Media.Capture.Frames;
using Windows.Media.MediaProperties;
using Windows.Storage.Streams;

namespace MediaProbe
{
    class ProbeResult
    {
        public bool canDualCapture { get; set; } = false;
        public object? groups { get; set; } = null;
        public string details { get; set; } = string.Empty;
    }

    class CaptureResult
    {
        public bool success { get; set; } = false;
        public int colorFramesSaved { get; set; } = 0;
        public int infraFramesSaved { get; set; } = 0;
        public string outDir { get; set; } = string.Empty;
        public string details { get; set; } = string.Empty;
    }

    class Program
    {
        static async Task<int> Main(string[] args)
        {
            var cmd = args.Length > 0 ? args[0].ToLowerInvariant() : "probe";

            try
            {
                if (cmd == "probe")
                {
                    var result = await RunProbe();
                    Console.WriteLine(JsonSerializer.Serialize(result));
                    return 0;
                }
                else if (cmd == "capture")
                {
                    var outDir = GetArgValue(args, "--outDir") ?? "media_out";
                    var durationStr = GetArgValue(args, "--duration") ?? "5";
                    if (!int.TryParse(durationStr, out int durationSec)) durationSec = 5;

                    var result = await RunCapture(outDir, durationSec);
                    Console.WriteLine(JsonSerializer.Serialize(result));
                    return result.success ? 0 : 2;
                }
                else
                {
                    Console.WriteLine(JsonSerializer.Serialize(new { error = $"unknown command '{cmd}'" }));
                    return 2;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"ERROR: {ex.Message}");
                Console.WriteLine(JsonSerializer.Serialize(new { error = ex.Message }));
                return 1;
            }
        }

        static string? GetArgValue(string[] args, string key)
        {
            for (int i = 0; i < args.Length; i++)
            {
                if (string.Equals(args[i], key, StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                {
                    return args[i + 1].Trim('"');
                }
                if (args[i].StartsWith(key + "=", StringComparison.OrdinalIgnoreCase))
                {
                    return args[i].Substring(key.Length + 1).Trim('"');
                }
            }
            return null;
        }

        static async Task<ProbeResult> RunProbe(string[] args)
        {
            var groupFilter = GetArgValue(args, "--group") ?? string.Empty;
            var groups = await MediaFrameSourceGroup.FindAllAsync();
            var infoList = new List<object>();
            bool anyDual = false;

            foreach (var g in groups)
            {
                if (!string.IsNullOrEmpty(groupFilter) && g.DisplayName.IndexOf(groupFilter, StringComparison.OrdinalIgnoreCase) < 0)
                {
                    continue;
                }
                Console.WriteLine($"Probing group: {g.DisplayName} (ID: {g.Id})");
                var srcInfos = g.SourceInfos.Select(si => new
                {
                    id = si.Id,
                    kind = si.SourceKind.ToString(),
                    mediaStreamType = si.MediaStreamType.ToString()
                }).ToArray();

                bool canDual = false;
                try
                {
                    var settings = new MediaCaptureInitializationSettings
                    {
                        SourceGroup = g,
                        SharingMode = MediaCaptureSharingMode.SharedReadOnly,
                        StreamingCaptureMode = StreamingCaptureMode.Video
                    };
                    var mc = new MediaCapture();
                    await mc.InitializeAsync(settings);
                    var frameSources = mc.FrameSources;
                    string? colorId = null;
                    string? infraId = null;

                    foreach (var kv in frameSources)
                    {
                        var id = kv.Key;
                        var src = kv.Value;
                        if (src.Info.SourceKind == MediaFrameSourceKind.Color && colorId == null) colorId = id;
                        if (src.Info.SourceKind == MediaFrameSourceKind.Infrared && infraId == null) infraId = id;
                    }
                    Console.WriteLine($"  - Color source: {(colorId != null ? "Yes" : "No")}");
                    Console.WriteLine($"  - Infrared source: {(infraId != null ? "Yes" : "No")}");

                    if (colorId != null && infraId != null)
                    {
                        // Enumerate IR media types
                        var irSource = frameSources[infraId];
                        var formats = new List<string>();
                        try
                        {
                            var profiles = await irSource.SupportedFormats.ToListAsync();
                            foreach (var fmt in profiles)
                            {
                                try
                                {
                                    string subtype = fmt.Subtype;
                                    uint width = 0, height = 0;
                                    fmt.VideoFormat?.GetFrameSize(out width, out height);
                                    uint fpsNum = 0, fpsDen = 0;
                                    fmt.VideoFormat?.GetFrameRate(out fpsNum, out fpsDen);
                                    formats.Add($"{subtype} ({width}x{height} @ {fpsNum}/{fpsDen} FPS)");
                                }
                                catch { continue; }
                            }
                            Console.WriteLine($"  - IR formats: [{string.Join(", ", formats)}]");
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"  - Failed to enumerate IR formats: {ex.Message}");
                        }

                        // Try creating readers with L8
                        MediaFrameReader? readerColor = null, readerInfra = null;
                        try
                        {
                            readerColor = await mc.CreateFrameReaderAsync(frameSources[colorId], MediaEncodingSubtypes.Bgra8);
                            Console.WriteLine("  - Color reader created");
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"  - Failed to create Color reader: {ex.Message}");
                        }
                        try
                        {
                            readerInfra = await mc.CreateFrameReaderAsync(frameSources[infraId], MediaEncodingSubtypes.L8);
                            Console.WriteLine("  - IR reader created (L8)");
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"  - Failed to create IR reader (L8): {ex.Message}");
                        }

                        if (readerColor != null && readerInfra != null)
                        {
                            var startColor = await readerColor.StartAsync();
                            Console.WriteLine($"  - Color reader start: {startColor}");
                            var startInfra = await readerInfra.StartAsync();
                            Console.WriteLine($"  - IR reader start (L8): {startInfra}");

                            if (startColor == MediaFrameReaderStartStatus.Success && startInfra == MediaFrameReaderStartStatus.Success)
                            {
                                canDual = true;
                                anyDual = true;
                                Console.WriteLine("  - Dual capture: Success");
                            }
                        }

                        // Cleanup
                        try { if (readerColor != null) await readerColor.StopAsync(); } catch { }
                        try { if (readerInfra != null) await readerInfra.StopAsync(); } catch { }
                        mc.Dispose();
                    }
                    else
                    {
                        Console.WriteLine("  - Dual capture: Failed (missing Color or IR source)");
                    }

                    infoList.Add(new { group = new { id = g.Id, displayName = g.DisplayName, sourceInfos = srcInfos }, canDualCapture = canDual });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"  - Probe error: {ex.Message}");
                    infoList.Add(new { group = new { id = g.Id, displayName = g.DisplayName, sourceInfos = srcInfos }, probeError = ex.Message });
                }
            }

            return new ProbeResult
            {
                canDualCapture = anyDual,
                groups = infoList,
                details = anyDual ? "Found a group that can open Color+Infrared concurrently" : "No group found that can open both concurrently"
            };
        }

        static async Task<CaptureResult> RunCapture(string outDir, int durationSec)
        {
            Directory.CreateDirectory(outDir);
            var groups = await MediaFrameSourceGroup.FindAllAsync();
            var captureSummary = new CaptureResult { success = false, colorFramesSaved = 0, infraFramesSaved = 0, outDir = outDir, details = "" };
            foreach (var g in groups)
            {
                try
                {
                    var settings = new MediaCaptureInitializationSettings { SourceGroup = g, SharingMode = MediaCaptureSharingMode.SharedReadOnly, StreamingCaptureMode = StreamingCaptureMode.Video };
                    var mc = new MediaCapture();
                    await mc.InitializeAsync(settings);
                    var fs = mc.FrameSources;
                    string? colorId = null;
                    string? infraId = null;
                    foreach (var kv in fs)
                    {
                        var id = kv.Key;
                        var src = kv.Value;
                        if (src.Info.SourceKind == MediaFrameSourceKind.Color && colorId == null) colorId = id;
                        if (src.Info.SourceKind == MediaFrameSourceKind.Infrared && infraId == null) infraId = id;
                    }
                    if (colorId == null || infraId == null)
                    {
                        mc.Dispose();
                        continue;
                    }
                    var frameReaderColor = await mc.CreateFrameReaderAsync(fs[colorId], MediaEncodingSubtypes.Bgra8);
                    var frameReaderInfra = await mc.CreateFrameReaderAsync(fs[infraId], MediaEncodingSubtypes.L8);
                    var colorDir = Path.Combine(outDir, "color");
                    var infraDir = Path.Combine(outDir, "infra");
                    Directory.CreateDirectory(colorDir);
                    Directory.CreateDirectory(infraDir);
                    int colorCount = 0;
                    int infraCount = 0;
                    int throttleMs = 100;
                    long lastColorSaved = 0;
                    long lastInfraSaved = 0;
                    frameReaderColor.FrameArrived += async (MediaFrameReader sender, MediaFrameArrivedEventArgs e) =>
                    {
                        Console.WriteLine("Color frame arrived"); // Debug: confirm event fires
                        try
                        {
                            using (var frame = sender.TryAcquireLatestFrame())
                            {
                                var vmf = frame?.VideoMediaFrame;
                                if (vmf == null) { Console.WriteLine("Color: No VideoMediaFrame"); return; }
                                SoftwareBitmap? sb = null;
                                bool disposeSb = false;
                                if (vmf.SoftwareBitmap != null)
                                {
                                    sb = vmf.SoftwareBitmap;
                                }
                                else if (vmf.Direct3DSurface != null)
                                {
                                    sb = await SoftwareBitmap.CreateCopyFromSurfaceAsync(vmf.Direct3DSurface);
                                    disposeSb = true;
                                }
                                if (sb == null) { Console.WriteLine("Color: No SoftwareBitmap available"); return; }
                                var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                                if (now - lastColorSaved >= throttleMs)
                                {
                                    lastColorSaved = now;
                                    var filePath = Path.Combine(colorDir, $"color_{DateTimeOffset.UtcNow:yyyyMMdd_HHmmss_fff}_{colorCount}.png");
                                    await SaveSoftwareBitmapAsPng(sb, filePath);
                                    Interlocked.Increment(ref colorCount);
                                }
                                if (disposeSb) sb.Dispose();
                            }
                        }
                        catch (Exception ex) { Console.WriteLine($"Color handler error: {ex.Message}"); }
                    };
                    frameReaderInfra.FrameArrived += async (MediaFrameReader sender, MediaFrameArrivedEventArgs e) =>
                    {
                        Console.WriteLine("Infra frame arrived"); // Debug: confirm event fires
                        try
                        {
                            using (var frame = sender.TryAcquireLatestFrame())
                            {
                                var vmf = frame?.VideoMediaFrame;
                                if (vmf == null) { Console.WriteLine("Infra: No VideoMediaFrame"); return; }
                                SoftwareBitmap? sb = null;
                                bool disposeSb = false;
                                if (vmf.SoftwareBitmap != null)
                                {
                                    sb = vmf.SoftwareBitmap;
                                }
                                else if (vmf.Direct3DSurface != null)
                                {
                                    sb = await SoftwareBitmap.CreateCopyFromSurfaceAsync(vmf.Direct3DSurface);
                                    disposeSb = true;
                                }
                                if (sb == null) { Console.WriteLine("Infra: No SoftwareBitmap available"); return; }
                                var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                                if (now - lastInfraSaved >= throttleMs)
                                {
                                    lastInfraSaved = now;
                                    var filePath = Path.Combine(infraDir, $"infra_{DateTimeOffset.UtcNow:yyyyMMdd_HHmmss_fff}_{infraCount}.png");
                                    await SaveSoftwareBitmapAsPng(sb, filePath);
                                    Interlocked.Increment(ref infraCount);
                                }
                                if (disposeSb) sb.Dispose();
                            }
                        }
                        catch (Exception ex) { Console.WriteLine($"Infra handler error: {ex.Message}"); }
                    };
                    var startC = await frameReaderColor.StartAsync();
                    var startI = await frameReaderInfra.StartAsync();
                    if (startC != MediaFrameReaderStartStatus.Success || startI != MediaFrameReaderStartStatus.Success)
                    {
                        captureSummary.details = $"Failed to start frame readers for group {g.DisplayName}";
                        try { await frameReaderColor.StopAsync(); } catch { }
                        try { await frameReaderInfra.StopAsync(); } catch { }
                        mc.Dispose();
                        continue;
                    }
                    await Task.Delay(durationSec * 1000);
                    try { await frameReaderColor.StopAsync(); } catch { }
                    try { await frameReaderInfra.StopAsync(); } catch { }
                    captureSummary.colorFramesSaved = colorCount;
                    captureSummary.infraFramesSaved = infraCount;
                    captureSummary.success = true;
                    captureSummary.details = $"Captured from group {g.DisplayName}";
                    mc.Dispose();
                    return captureSummary;
                }
                catch (Exception)
                {
                    // continue to next group
                    continue;
                }
            }
            captureSummary.details = "No group with both Color and Infrared available for capture.";
            return captureSummary;
        }

        static async Task SaveSoftwareBitmapAsPng(SoftwareBitmap softwareBitmap, string outPath)
        {
            try
            {
                using (var stream = new InMemoryRandomAccessStream())
                {
                    var encoder = await BitmapEncoder.CreateAsync(BitmapEncoder.PngEncoderId, stream);
                    BitmapPixelFormat targetFormat = BitmapPixelFormat.Bgra8;
                    SoftwareBitmap? converted = softwareBitmap;
                    if (softwareBitmap.BitmapPixelFormat != targetFormat)
                    {
                        converted = SoftwareBitmap.Convert(softwareBitmap, targetFormat);
                    }

                    encoder.SetSoftwareBitmap(converted);
                    await encoder.FlushAsync();

                    stream.Seek(0);
                    var reader = new DataReader(stream.GetInputStreamAt(0));
                    var size = (uint)stream.Size;
                    await reader.LoadAsync(size);
                    var bytes = new byte[size];
                    reader.ReadBytes(bytes);
                    await File.WriteAllBytesAsync(outPath, bytes);
                }
            }
            catch
            {
                // swallow errors to keep helper robust
            }
        }
    }
}
