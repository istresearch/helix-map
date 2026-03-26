/**
 * MCP App initialization layer for helix-map
 * Detects whether app is running in MCP host or standalone,
 * and bridges the two modes via shared rendering logic.
 */

import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import type { MapFeatureCollection } from "@/types/map";
import React, { createContext, useContext, useMemo } from "react";

export interface McpAppContextType {
  isMcpApp: boolean;
  location?: string;
  clearExisting?: boolean;
  mapFeatures?: MapFeatureCollection;
}

const McpAppContext = createContext<McpAppContextType>({
  isMcpApp: false,
});

export function useMcpContext() {
  return useContext(McpAppContext);
}

/**
 * Detect if running inside MCP host.
 * Checks for sandboxed iframe (origin 'null') or being embedded in a parent frame.
 */
export function detectMcpMode(): boolean {
  return window.location.origin === "null" || window.parent !== window;
}

/**
 * Initialize MCP App and extract parameters from tool invocation.
 */
export async function initMcpApp(): Promise<McpAppContextType> {
  const app = new App({
    name: "helix-map",
    version: "1.0.0",
    capabilities: {
      displayModes: ["inline"],
    },
  });

  const extractContext = (payload: unknown): McpAppContextType => {
    const obj = payload && typeof payload === "object"
      ? payload as Record<string, unknown>
      : {};

    return {
      isMcpApp: true,
      location: typeof obj.location === "string" ? obj.location : undefined,
      clearExisting: typeof obj.clearExisting === "boolean" ? obj.clearExisting : undefined,
      mapFeatures: (obj.mapFeatures as MapFeatureCollection | undefined),
    };
  };

  const contextPromise = new Promise<McpAppContextType>((resolve) => {
    let resolved = false;

    const resolveOnce = (context: McpAppContextType) => {
      if (resolved) return;
      resolved = true;
      resolve(context);
    };

    app.ontoolinput = (input) => {
      resolveOnce(extractContext(input.arguments));
    };

    app.ontoolresult = (result) => {
      resolveOnce(extractContext(result.structuredContent));
    };

    setTimeout(() => resolveOnce({ isMcpApp: true }), 500);
  });

  // Handle host context changes (theme, styles, safe area insets)
  app.onhostcontextchanged = (ctx) => {
    if (ctx.theme) applyDocumentTheme(ctx.theme);
    if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
    if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);

    // Apply safe area insets
    if (ctx.safeAreaInsets) {
      const { top, right, bottom, left } = ctx.safeAreaInsets;
      document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
    }
  };

  // Handle teardown
  app.onteardown = async () => {
    return {};
  };

  // Connect to host
  await app.connect(new PostMessageTransport());

  return contextPromise;
}

/**
 * Initialize standalone web app mode.
 */
export function initStandaloneApp(): McpAppContextType {
  return {
    isMcpApp: false,
    location: new URL(location.href).searchParams.get("location") ?? undefined,
  };
}

/**
 * Provider component that wraps the app with MCP context.
 */
export interface McpAppProviderProps {
  context: McpAppContextType;
  children: React.ReactNode;
}

export function McpAppProvider({ context, children }: McpAppProviderProps) {
  const value = useMemo(() => context, [context]);
  return (
    <McpAppContext.Provider value={value}>{children}</McpAppContext.Provider>
  );
}
