import React from 'react';
import { SettingsProvider } from "@/components/settings/SettingsContext";

function LayoutInner({ children }) {
  return (
    <div className="flex flex-col h-screen bg-muted/20 overflow-hidden">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8 min-h-full">
          {children}
        </div>
      </div>
    </div>
  );
}


export default function Layout({ children, currentPageName }) {
  return (
    <SettingsProvider>
      <LayoutInner>{children}</LayoutInner>
    </SettingsProvider>
  );
}