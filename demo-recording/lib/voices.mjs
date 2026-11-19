// Free text-to-speech voice (Microsoft Andrew neural, picked over local Kokoro by ear). Returns speak(text, basePath) -> path of the audio file it wrote.
import { renameSync } from "node:fs";
import { dirname } from "node:path";

export const VOICES = {
  /** Microsoft "Andrew" neural voice (the Edge Read Aloud service, online; only the script text is sent). */
  async andrew() {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const once = async (text, base) => {
      const tts = new MsEdgeTTS();
      try {
        await tts.setMetadata("en-US-AndrewNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        const { audioFilePath } = await tts.toFile(dirname(base), text, { rate: "-4%" });
        const file = `${base}.mp3`;
        renameSync(audioFilePath, file);
        return file;
      } finally {
        tts.close();
      }
    };
    // The online service sometimes drops a connection mid-line; a fresh one usually succeeds.
    return async (text, base) => {
      for (let attempt = 1; ; attempt++) {
        try {
          return await once(text, base);
        } catch (error) {
          if (attempt === 5) throw error;
          console.warn(`Retrying line (${error.message})`);
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    };
  },
};
