import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../src/ui/store/useAppStore";
import type { Attachment } from "../src/ui/types";

const resetStore = () => {
  const state = useAppStore.getState();
  useAppStore.setState({
    ...state,
    sessions: {},
    activeSessionId: null,
    historyRequested: new Set(),
    globalError: null,
    schedulerDefaultTemperature: null,
    schedulerDefaultSendTemperature: null,
    attachments: []
  }, true);
};

describe("useAppStore session.history pagination", () => {
  beforeEach(() => resetStore());

  it("sets initial history and pagination state", () => {
    useAppStore.getState().handleServerEvent({
      type: "session.history",
      payload: {
        sessionId: "s1",
        status: "completed",
        messages: [{ type: "user_prompt", prompt: "m2" } as any],
        hasMore: true,
        nextCursor: 123,
        page: "initial"
      }
    } as any);

    const session = useAppStore.getState().sessions["s1"];
    expect(session.messages.length).toBe(1);
    expect(session.historyHasMore).toBe(true);
    expect(session.historyCursor).toBe(123);
  });

  it("prepends older messages without losing newer ones", () => {
    useAppStore.getState().handleServerEvent({
      type: "session.history",
      payload: {
        sessionId: "s1",
        status: "completed",
        messages: [{ type: "user_prompt", prompt: "m2" } as any],
        page: "initial"
      }
    } as any);

    useAppStore.getState().handleServerEvent({
      type: "session.history",
      payload: {
        sessionId: "s1",
        status: "completed",
        messages: [{ type: "user_prompt", prompt: "m1" } as any],
        page: "prepend"
      }
    } as any);

    const session = useAppStore.getState().sessions["s1"];
    expect(session.messages.map((m: any) => m.prompt)).toEqual(["m1", "m2"]);
  });
});

describe("scheduler.default_temperature.loaded event", () => {
  beforeEach(() => resetStore());

  it("saves temperature and sendTemperature to store", () => {
    useAppStore.getState().handleServerEvent({
      type: "scheduler.default_temperature.loaded",
      payload: { temperature: 0.7, sendTemperature: true }
    } as any);

    const state = useAppStore.getState();
    expect(state.schedulerDefaultTemperature).toBe(0.7);
    expect(state.schedulerDefaultSendTemperature).toBe(true);
  });

  it("handles sendTemperature=false correctly", () => {
    useAppStore.getState().handleServerEvent({
      type: "scheduler.default_temperature.loaded",
      payload: { temperature: 0.3, sendTemperature: false }
    } as any);

    expect(useAppStore.getState().schedulerDefaultSendTemperature).toBe(false);
  });

  it("handles temperature=0 without treating it as falsy", () => {
    useAppStore.getState().handleServerEvent({
      type: "scheduler.default_temperature.loaded",
      payload: { temperature: 0, sendTemperature: true }
    } as any);

    expect(useAppStore.getState().schedulerDefaultTemperature).toBe(0);
  });
});

describe("scheduler default temperature initial state", () => {
  it("has null defaults before loading", () => {
    resetStore();
    const state = useAppStore.getState();
    expect(state.schedulerDefaultTemperature).toBeNull();
    expect(state.schedulerDefaultSendTemperature).toBeNull();
  });
});

describe("attachments (multimodal support)", () => {
  beforeEach(() => resetStore());

  it("starts with empty attachments array", () => {
    const state = useAppStore.getState();
    expect(state.attachments).toEqual([]);
  });

  it("can add an attachment", () => {
    const attachment: Attachment = {
      id: "test-1",
      type: "image",
      name: "test.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,abc123",
      size: 1024
    };
    
    useAppStore.getState().addAttachment(attachment);
    
    const state = useAppStore.getState();
    expect(state.attachments).toHaveLength(1);
    expect(state.attachments[0]).toEqual(attachment);
  });

  it("can add multiple attachments", () => {
    const attachment1: Attachment = {
      id: "test-1",
      type: "image",
      name: "test1.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,abc123",
      size: 1024
    };
    const attachment2: Attachment = {
      id: "test-2",
      type: "audio",
      name: "test2.mp3",
      mimeType: "audio/mpeg",
      dataUrl: "data:audio/mpeg;base64,def456",
      size: 2048
    };
    
    useAppStore.getState().addAttachment(attachment1);
    useAppStore.getState().addAttachment(attachment2);
    
    const state = useAppStore.getState();
    expect(state.attachments).toHaveLength(2);
  });

  it("can remove an attachment by id", () => {
    const attachment1: Attachment = {
      id: "test-1",
      type: "image",
      name: "test1.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,abc123",
      size: 1024
    };
    const attachment2: Attachment = {
      id: "test-2",
      type: "video",
      name: "test2.mp4",
      mimeType: "video/mp4",
      dataUrl: "data:video/mp4;base64,def456",
      size: 4096
    };
    
    useAppStore.getState().addAttachment(attachment1);
    useAppStore.getState().addAttachment(attachment2);
    useAppStore.getState().removeAttachment("test-1");
    
    const state = useAppStore.getState();
    expect(state.attachments).toHaveLength(1);
    expect(state.attachments[0].id).toBe("test-2");
  });

  it("can clear all attachments", () => {
    const attachment: Attachment = {
      id: "test-1",
      type: "image",
      name: "test.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,abc123",
      size: 1024
    };
    
    useAppStore.getState().addAttachment(attachment);
    useAppStore.getState().clearAttachments();
    
    const state = useAppStore.getState();
    expect(state.attachments).toEqual([]);
  });
});
