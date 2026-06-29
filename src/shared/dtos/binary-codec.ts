/**
 * Ultra-dense Binary Telemetry Codec
 * Serializes telemetry state packets to ArrayBuffer to minimize network overhead.
 */
export interface TelemetryPacket {
  typeId: number; // 1 byte
  agentId: number; // 2 bytes (Uint16)
  value: number; // 8 bytes (Float64)
  timestamp: number; // 8 bytes (Float64)
}

export class BinaryCodec {
  /**
   * Encodes a TelemetryPacket into a 19-byte ArrayBuffer
   */
  public static encode(packet: TelemetryPacket): ArrayBuffer {
    const buffer = new ArrayBuffer(19);
    const view = new DataView(buffer);

    view.setUint8(0, packet.typeId);
    view.setUint16(1, packet.agentId, true); // little-endian
    view.setFloat64(3, packet.value, true);
    view.setFloat64(11, packet.timestamp || Date.now(), true);

    return buffer;
  }

  /**
   * Decodes a 19-byte ArrayBuffer back into a TelemetryPacket
   */
  public static decode(buffer: ArrayBuffer): TelemetryPacket {
    const view = new DataView(buffer);

    const typeId = view.getUint8(0);
    const agentId = view.getUint16(1, true);
    const value = view.getFloat64(3, true);
    const timestamp = view.getFloat64(11, true);

    return {
      typeId,
      agentId,
      value,
      timestamp,
    };
  }
}
