"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Label, Textarea, Alert, Badge } from "@/components/ui/primitives";
import type { ReportDetail } from "@/components/report/types";

// MediaRecorder-mimeType's op volgorde van voorkeur — Chrome/Firefox
// ondersteunen doorgaans audio/webm;codecs=opus, Safari vaak alleen
// audio/mp4. isTypeSupported() bepaalt bij het opnemen welke daadwerkelijk
// werkt in de browser van de gebruiker.
const RECORDER_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return RECORDER_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function StepBronnen({
  report,
  onUploadFiles,
  onUploadText,
  onDeleteSource,
  onAdvance,
  uploadAudioFile,
  pendingAudioFile,
  audioBusy,
  audioError,
  downloadedPending,
  onRetryPendingAudio,
  onDownloadPendingAudio,
  onDiscardPendingAudio,
}: {
  report: ReportDetail;
  onUploadFiles: (files: FileList) => Promise<void>;
  onUploadText: (text: string, filename: string) => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  onAdvance: () => Promise<void>;
  // Deze zeven props leven bewust in de ouder (ReportWizard), niet hier —
  // StepBronnen wordt volledig unmount/remount bij het wisselen van stap, dus
  // een nog niet verwerkte opname zou anders stilzwijgend verloren gaan
  // zodra de gebruiker even naar een andere stap navigeert.
  uploadAudioFile: (file: File) => Promise<void>;
  pendingAudioFile: File | null;
  audioBusy: boolean;
  audioError: string | null;
  downloadedPending: boolean;
  onRetryPendingAudio: () => void;
  onDownloadPendingAudio: () => void;
  onDiscardPendingAudio: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState("");
  const [pastedFilename, setPastedFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  // Alleen voor fouten bij het STARTEN van een opname (geen microfoon-
  // ondersteuning/toestemming) — hoeft niet in de ouder te leven, want zonder
  // geslaagde opname is er niets om bij stapwisseling te verliezen.
  const [recordingStartError, setRecordingStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);

  // Zorgt dat de microfoon altijd vrijkomt, ook als de gebruiker tijdens
  // een opname wegnavigeert.
  useEffect(() => {
    return () => {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const totalChars = report.sources.reduce((sum, s) => sum + s.charCount, 0);
  const projectedChars = totalChars + pastedText.length;
  const overLimit = projectedChars > report.maxTotalInputChars;

  async function handleFileChange() {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onUploadFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uploaden mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAudioFileChange() {
    const files = audioInputRef.current?.files;
    if (!files || files.length === 0) return;
    await uploadAudioFile(files[0]!);
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  async function startRecording() {
    setRecordingStartError(null);
    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      setRecordingStartError(
        "Opnemen in de browser wordt hier niet ondersteund. Upload een bestaande opname in plaats daarvan.",
      );
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setRecordingStartError(
        "Kon geen toegang krijgen tot de microfoon. Controleer de microfoon-toestemming van deze browser.",
      );
      return;
    }

    recordingStreamRef.current = stream;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      recordedChunksRef.current = [];
      if (blob.size === 0) return;
      const filename = `Opname ${new Date().toLocaleString("nl-NL")}.${extensionForMimeType(mimeType)}`;
      const file = new File([blob], filename, { type: mimeType });
      void uploadAudioFile(file);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecordingSeconds(0);
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  async function handlePasteSubmit() {
    if (pastedText.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onUploadText(pastedText, pastedFilename || "Geplakte tekst");
      setPastedText("");
      setPastedFilename("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toevoegen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setError(null);
    try {
      await onDeleteSource(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Broninformatie</h2>
        <p className="text-sm text-gray-500">
          Upload gespreksnotities/aantekeningen als .docx-bestand, plak tekst, of voeg een
          gespreksopname toe.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-2">
        <Label htmlFor="fileUpload">Bestand uploaden (.docx)</Label>
        <input
          id="fileUpload"
          ref={fileInputRef}
          type="file"
          accept=".docx"
          multiple
          disabled={busy}
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-vera-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-vera-700 hover:file:bg-vera-100"
        />
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Label htmlFor="audioUpload">Gespreksopname toevoegen</Label>
        <p className="text-xs text-gray-500">
          De opname wordt automatisch omgezet naar tekst; alleen dat transcript wordt bewaard —
          de audio zelf wordt nooit opgeslagen. Zorg dat betrokkenen weten dat het gesprek wordt
          opgenomen.
        </p>
        {!isOnline && (
          <Alert variant="warning">
            Geen internetverbinding. Opnemen werkt gewoon offline, maar verwerken tot tekst lukt
            pas zodra je weer online bent.
          </Alert>
        )}
        {audioError && <Alert variant="error">{audioError}</Alert>}

        {pendingAudioFile ? (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800">
              De opname &quot;{pendingAudioFile.name}&quot; is nog niet verwerkt en is bewust bewaard zodat
              hij niet verloren gaat — probeer opnieuw zodra je weer verbinding hebt, of download
              hem naar dit apparaat.
              {downloadedPending && " Gedownload naar dit apparaat."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={audioBusy} onClick={onRetryPendingAudio} className="text-xs">
                {audioBusy ? "Bezig..." : "Probeer opnieuw"}
              </Button>
              <Button variant="ghost" onClick={onDownloadPendingAudio} className="text-xs">
                Download naar dit apparaat
              </Button>
              <Button variant="ghost" disabled={audioBusy} onClick={onDiscardPendingAudio} className="text-xs text-red-600">
                Weggooien
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recordingStartError && <Alert variant="error">{recordingStartError}</Alert>}
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="audioUpload"
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                disabled={audioBusy || recording}
                onChange={handleAudioFileChange}
                className="block text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-vera-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-vera-700 hover:file:bg-vera-100"
              />
              <span className="text-xs text-gray-400">of</span>
              {recording ? (
                <Button variant="danger" onClick={stopRecording} className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Stop opname ({formatDuration(recordingSeconds)})
                </Button>
              ) : (
                <Button variant="secondary" disabled={audioBusy} onClick={startRecording}>
                  🎙️ Opname starten
                </Button>
              )}
            </div>
          </div>
        )}
        {audioBusy && <p className="text-xs text-gray-500">Bezig met transcriberen — dit kan even duren...</p>}
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <Label htmlFor="pastedFilename">Of plak tekst (bijv. losse aantekeningen)</Label>
        <input
          id="pastedFilename"
          type="text"
          placeholder="Label (optioneel), bijv. 'Gespreksnotitie 14-09'"
          value={pastedFilename}
          onChange={(e) => setPastedFilename(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <Textarea
          rows={6}
          placeholder="Plak hier de aantekeningen of gespreksnotities..."
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
        />
        <p className={`text-xs ${overLimit ? "font-medium text-red-600" : "text-gray-500"}`}>
          {projectedChars.toLocaleString("nl-NL")} / {report.maxTotalInputChars.toLocaleString("nl-NL")}{" "}
          tekens totaal (incl. reeds toegevoegde bronnen)
          {overLimit && " — dit overschrijdt de limiet, verwijder eerst tekst"}
        </p>
        <Button
          variant="secondary"
          disabled={busy || pastedText.trim().length === 0 || overLimit}
          onClick={handlePasteSubmit}
        >
          Tekst toevoegen
        </Button>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Toegevoegde bronnen</h3>
          <span className="text-xs text-gray-500">{totalChars.toLocaleString("nl-NL")} tekens totaal</span>
        </div>
        {report.sources.length === 0 ? (
          <p className="text-sm text-gray-500">Nog geen bronnen toegevoegd.</p>
        ) : (
          <ul className="space-y-2">
            {report.sources.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-gray-700">{s.filename}</span>{" "}
                  <Badge variant="neutral">
                    {s.sourceType === "DOCX" ? ".docx" : s.sourceType === "AUDIO" ? "audio (transcript)" : "tekst"}
                  </Badge>{" "}
                  <span className="text-xs text-gray-400">{s.charCount.toLocaleString("nl-NL")} tekens</span>
                </div>
                <Button
                  variant="ghost"
                  disabled={busy || audioBusy}
                  onClick={() => handleDelete(s.id)}
                  className="text-xs text-red-600"
                >
                  Verwijderen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button disabled={busy || audioBusy || report.sources.length === 0} onClick={onAdvance}>
        Verder naar VERA-analyse →
      </Button>
    </Card>
  );
}
