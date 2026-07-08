import { useCallback, useState, useRef, useEffect } from "react";
import { Upload, X, Camera, MapPin, AlertTriangle, Clock, User, Building2, Download } from "lucide-react";

export interface GeoMeta {
  latitude: string;
  longitude: string;
  capturedAt: string;
}

interface ImageUploaderProps {
  label: string;
  sublabel: string;
  variant?: "workplace";
  image: string | null;
  onImageChange: (base64: string | null, geo?: GeoMeta | null) => void;
  timestamp?: string | null;
  employeeName?: string;
  officeName?: string;
  zoneName?: string;
  onGeoDenied?: () => void;
}

// Reverse-geocode lat/lng to a readable city/state string
const reverseGeocode = async (lat: string, lng: string): Promise<string> => {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await resp.json();
    if (data?.display_name) {
      const parts = data.display_name.split(",").map((s: string) => s.trim());
      return parts.slice(0, 3).join(", ");
    }
  } catch {
    // fall back silently
  }
  return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
};

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const ImageUploader = ({
  label,
  sublabel,
  variant = "workplace",
  image,
  onImageChange,
  employeeName = "Employee",
  officeName = "Office",
  zoneName = "Unspecified Zone",
  onGeoDenied,
}: ImageUploaderProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "fetching" | "granted" | "denied">("idle");
  const [geoMeta, setGeoMeta] = useState<GeoMeta | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // Camera modal state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Store GPS coords while camera is open so capturePhoto can use them
  const pendingGeoRef = useRef<GeoMeta | null>(null);
  const pendingAddrRef = useRef<string>("");

  // ─── Stop camera stream ───────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  // ─── KEY FIX: Attach stream to <video> AFTER the modal renders ────────────
  // useEffect runs after React commits the DOM, so videoRef.current is available
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.error("Video play failed:", err);
      });
    }
  }, [cameraOpen]); // runs whenever cameraOpen becomes true

  // ─── File / drag-drop upload ─────────────────────────────────────────────
  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageChange(e.target?.result as string, null);
        setGeoMeta(null);
        setAddress(null);
      };
      reader.readAsDataURL(file);
    },
    [onImageChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ─── Open camera with getUserMedia ──────────────────────────────────────
  // CORRECT sequence:
  //  Step 1 → Request camera permission → open stream
  //  Step 2 → setCameraOpen(true) → React renders modal
  //  Step 3 → useEffect above fires → attaches stream to <video>
  //  Step 4 → GPS fetches in background (doesn't block camera UI)
  const openCamera = useCallback(async () => {
    setCameraError(null);
    setGeoStatus("fetching");
    pendingGeoRef.current = null;
    pendingAddrRef.current = "";

    // Step 1: Request camera stream
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch {
      // Retry without facingMode (some desktop browsers)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2) {
        console.error("Camera access denied:", err2);
        setCameraError("Camera permission was denied. Please allow camera access in your browser settings.");
        setGeoStatus("denied");
        onGeoDenied?.();
        return;
      }
    }

    // Step 2: Store stream ref and open modal
    // The useEffect above will attach it to <video> once the DOM renders
    streamRef.current = stream;
    setCameraOpen(true);

    // Step 3: Fetch GPS in background — never blocks camera
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          const now = new Date().toISOString();
          const meta: GeoMeta = { latitude: lat, longitude: lng, capturedAt: now };
          pendingGeoRef.current = meta;
          setGeoMeta(meta);
          setGeoStatus("granted");
          // Reverse geocode in background
          const addr = await reverseGeocode(lat, lng);
          pendingAddrRef.current = addr;
          setAddress(addr);
        },
        () => {
          // GPS denied/timeout — use fallback coords so camera still works
          const lat = "0.000000";
          const lng = "0.000000";
          const now = new Date().toISOString();
          const meta: GeoMeta = { latitude: lat, longitude: lng, capturedAt: now };
          pendingGeoRef.current = meta;
          setGeoMeta(meta);
          setGeoStatus("granted");
          pendingAddrRef.current = "GPS Unavailable";
          setAddress("GPS Unavailable");
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    } else {
      // No geolocation API (insecure context) — use placeholder, camera still opens
      const now = new Date().toISOString();
      const meta: GeoMeta = { latitude: "0.000000", longitude: "0.000000", capturedAt: now };
      pendingGeoRef.current = meta;
      setGeoMeta(meta);
      setGeoStatus("granted");
      pendingAddrRef.current = "Location Unavailable";
      setAddress("Location Unavailable");
    }
  }, [onGeoDenied]);

  // ─── Capture photo from live video stream ────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCapturing(true);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);

    const now = new Date().toISOString();
    const geo = pendingGeoRef.current;
    const lat = geo?.latitude ?? "0.000000";
    const lng = geo?.longitude ?? "0.000000";
    const addr = pendingAddrRef.current || "";

    const base64 = canvas.toDataURL("image/jpeg", 0.92);
    // Embed geo prefix so applyWatermark can extract and stamp it
    const payload = `__geo:${lat},${lng}:${addr}__${base64}`;
    const finalMeta: GeoMeta = { latitude: lat, longitude: lng, capturedAt: now };

    onImageChange(payload, finalMeta);
    setGeoMeta(finalMeta);

    stopStream();
    setCameraOpen(false);
    setCapturing(false);
  }, [onImageChange, stopStream]);

  const closeCamera = useCallback(() => {
    stopStream();
    setCameraOpen(false);
    setGeoStatus("idle");
    setCameraError(null);
  }, [stopStream]);

  // ─── Fallback: native <input capture> for browsers without getUserMedia ───
  const handleNativeCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const lat = e.target.dataset.lat || "0.000000";
      const lng = e.target.dataset.lng || "0.000000";
      const addr = e.target.dataset.addr || "";
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        const capturedAt = new Date().toISOString();
        const meta: GeoMeta = { latitude: lat, longitude: lng, capturedAt };
        onImageChange(`__geo:${lat},${lng}:${addr}__${base64}`, meta);
        setGeoMeta(meta);
        setAddress(addr || null);
      };
      reader.readAsDataURL(file);
      // Reset dataset
      e.target.dataset.lat = "";
      e.target.dataset.lng = "";
      e.target.dataset.addr = "";
      // Allow re-selecting the same file
      e.target.value = "";
    },
    [onImageChange]
  );

  // ─── Main button click ───────────────────────────────────────────────────
  const handleCameraButtonClick = useCallback(async () => {
    // Check if getUserMedia is available (requires HTTPS or localhost)
    const canUseGetUserMedia =
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia === "function";

    if (canUseGetUserMedia) {
      await openCamera();
    } else {
      // Fallback: native <input capture="environment"> for HTTP / old browsers
      setGeoStatus("fetching");

      const triggerNativeCamera = (lat: string, lng: string, addr: string) => {
        if (cameraInputRef.current) {
          cameraInputRef.current.dataset.lat = lat;
          cameraInputRef.current.dataset.lng = lng;
          cameraInputRef.current.dataset.addr = addr;
          cameraInputRef.current.click();
        }
        setGeoStatus("granted");
      };

      if (!navigator.geolocation) {
        triggerNativeCamera("0.000000", "0.000000", "Location Unavailable");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          let addr = "";
          try { addr = await reverseGeocode(lat, lng); } catch { /* ok */ }
          triggerNativeCamera(lat, lng, addr);
        },
        () => {
          // GPS denied — still open the native camera with blank coords
          triggerNativeCamera("0.000000", "0.000000", "GPS Unavailable");
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    }
  }, [openCamera]);

  // ─── Styling helpers ─────────────────────────────────────────────────────
  const borderColor = "border-primary/30";
  const hoverBorder = "hover:border-primary/50";
  const tagBg = "bg-primary/10 text-primary";
  const accentText = "text-primary";
  const accentBg = "bg-primary/5 border-primary/20";

  // Strip geo prefix for display
  const displaySrc = image ? image.replace(/^__geo:[^_]*__/, "") : null;

  return (
    <div className="space-y-2">
      {/* Label Row */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${tagBg}`}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{sublabel}</span>
      </div>

      {/* ── Full-screen Camera Modal ─────────────────────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm shrink-0">
            <span className="text-white font-semibold text-sm">{label} — Take Photo</span>
            {geoStatus === "fetching" && (
              <span className="flex items-center gap-1.5 text-xs text-yellow-400 animate-pulse">
                <MapPin className="h-3.5 w-3.5" />
                Fetching GPS…
              </span>
            )}
            {geoStatus === "granted" && geoMeta && parseFloat(geoMeta.latitude) !== 0 && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <MapPin className="h-3.5 w-3.5" />
                {parseFloat(geoMeta.latitude).toFixed(4)}, {parseFloat(geoMeta.longitude).toFixed(4)}
              </span>
            )}
            <button
              onClick={closeCamera}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Live viewfinder */}
          <div className="flex-1 relative overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Rule-of-thirds grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
                backgroundSize: "33.33% 33.33%",
              }}
            />
          </div>

          {/* Bottom capture bar */}
          <div className="flex items-center justify-center gap-8 px-6 py-6 bg-black/80 backdrop-blur-sm shrink-0">
            {/* Cancel */}
            <button
              onClick={closeCamera}
              className="p-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Cancel"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Shutter button */}
            <button
              onClick={capturePhoto}
              disabled={capturing}
              aria-label="Capture photo"
              className="w-18 h-18 rounded-full border-[5px] border-white bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-all active:scale-90 shadow-2xl flex items-center justify-center"
              style={{ width: 72, height: 72 }}
            >
              <div className="w-12 h-12 rounded-full bg-white shadow-inner" />
            </button>

            {/* Spacer to keep shutter centred */}
            <div style={{ width: 52, height: 52 }} />
          </div>
        </div>
      )}

      {/* Camera error toast */}
      {cameraError && !cameraOpen && (
        <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/25 rounded-xl px-3.5 py-3 mt-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-destructive">Camera Error</p>
            <p className="text-xs text-destructive/75 mt-0.5">{cameraError}</p>
          </div>
        </div>
      )}

      {/* ── Image Preview (after capture/upload) ────────────────────────── */}
      {displaySrc ? (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-border group">
            <img
              src={displaySrc}
              alt={label}
              className="w-full h-auto object-contain bg-black/5"
            />
            {/* Download button — bottom right, visible on hover */}
            <a
              href={displaySrc}
              download={`${label.toLowerCase()}-geotagged.jpg`}
              className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-medium z-10"
              title="Download image with geotag"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            {/* Remove button — top right */}
            <button
              onClick={() => {
                onImageChange(null, null);
                setGeoMeta(null);
                setAddress(null);
                setGeoStatus("idle");
                setCameraError(null);
              }}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-foreground/70 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Geo Tag Details Container ──────────────────────────────── */}
          {geoMeta && (
            <div className={`rounded-xl border ${accentBg} p-4 space-y-3`}>
              {/* Title */}
              <div className="flex items-center gap-2">
                <MapPin className={`h-4 w-4 ${accentText} flex-shrink-0`} />
                <p className={`text-xs font-bold uppercase tracking-wider ${accentText}`}>
                  📍 Geo Tag Details
                </p>
              </div>

              {/* 2-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <GeoField icon={<MapPin className="h-3.5 w-3.5" />} label="Latitude" value={geoMeta.latitude} />
                <GeoField icon={<MapPin className="h-3.5 w-3.5" />} label="Longitude" value={geoMeta.longitude} />
                <GeoField icon={<Clock className="h-3.5 w-3.5" />} label="Captured At" value={formatTimestamp(geoMeta.capturedAt)} />
                <GeoField icon={<User className="h-3.5 w-3.5" />} label="Employee" value={employeeName} />
                <GeoField icon={<Building2 className="h-3.5 w-3.5" />} label="Office" value={officeName} />
                <GeoField icon={<MapPin className="h-3.5 w-3.5" />} label="Zone" value={zoneName} />
              </div>

              {/* Summary lines */}
              <div className="border-t border-border/40 pt-2.5 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="mr-1">📍</span>
                  <span className="font-medium text-foreground">Location:</span>{" "}
                  {parseFloat(geoMeta.latitude).toFixed(5)}, {parseFloat(geoMeta.longitude).toFixed(5)}
                  {address && <span className="ml-1 text-muted-foreground/70">({address})</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="mr-1">🕒</span>
                  <span className="font-medium text-foreground">Captured at:</span>{" "}
                  {formatTimestamp(geoMeta.capturedAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Hidden native <input> — fallback camera for HTTP / old devices */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleNativeCameraChange}
            className="hidden"
          />

          {/* Drag-drop / file upload zone */}
          <label
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center h-40 sm:h-48 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${borderColor} ${hoverBorder} ${
              isDragOver ? "bg-primary/5" : "bg-muted/50"
            }`}
          >
            <input type="file" accept="image/*" onChange={handleInputChange} className="hidden" />
            <Upload className="h-7 w-7 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">Drop image or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 10MB</p>
          </label>

          {/* Take Photo with Geotag button */}
          <button
            type="button"
            onClick={handleCameraButtonClick}
            disabled={geoStatus === "fetching"}
            className={`w-full flex items-center justify-center gap-2.5 rounded-xl border-2 border-dashed py-3.5 cursor-pointer transition-all ${borderColor} ${hoverBorder} bg-muted/50 hover:bg-muted/80 disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {geoStatus === "fetching" ? (
              <>
                <MapPin className="h-5 w-5 text-primary animate-pulse" />
                <span className="text-sm font-medium text-foreground">Opening camera…</span>
              </>
            ) : (
              <>
                <Camera className="h-5 w-5 text-muted-foreground" />
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Take Photo with Geotag</span>
              </>
            )}
          </button>

          {/* Denied warning */}
          {geoStatus === "denied" && !cameraError && (
            <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/25 rounded-xl px-3.5 py-3">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-destructive">Camera Access Required</p>
                <p className="text-xs text-destructive/75 mt-0.5">
                  Please allow camera access in your browser or device settings, then try again.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Small geo field row ──────────────────────────────────────────────────────
const GeoField = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-2 text-xs">
    <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
    <div className="min-w-0">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold text-foreground break-all">{value}</span>
    </div>
  </div>
);

export default ImageUploader;
