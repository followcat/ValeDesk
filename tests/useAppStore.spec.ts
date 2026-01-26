import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../src/ui/store/useAppStore";

const resetStore = () => {
  const state = useAppStore.getState();
  useAppStore.setState({
    ...state,
    sessions: {},
    activeSessionId: null,
    historyRequested: new Set(),
    globalError: null
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
