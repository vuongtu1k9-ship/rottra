export function listVoices(): Array<{ voice: string; display_name: string; group: string }> {
  return [{ voice: "Junhao", display_name: "Native Browser", group: "Native" }];
}

export function getVoiceAudioCodes(voiceName: string): number[][] {
  return [];
}

export async function generateSpeech(text: string, voice: string = "Junhao"): Promise<string | null> {
  // Always return null to force the client to use native browser speech synthesis
  // as per the 100% self-hosted technology direction without heavy models.
  return null;
}
