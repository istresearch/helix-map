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
import React, { createContext, useContext, useMemo } from "react";

export interface McpAppContextType {
  isMcpApp: boolean;
  location?: string;
}

const McpAppContext = createContext<McpAppContextType>({
  isMcpApp: false,
});

export function useMcpContext() {
  return useContext(McpAppContext);
}

/**
 * Detect if running inside MCP host.
 * The sandboxed iframe has origin 'null'.
 */
export function detectMcpMode(): boolean {
  return window.location.origin === "null";
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

  // Get the location from tool input
  const context = await new Promise<McpAppContextType>((resolve) => {
    app.ontoolinput = (input) => {
      const location = input.arguments?.location as string | undefined;
      resolve({ isMcpApp: true, location });
    };
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

  return context;
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
