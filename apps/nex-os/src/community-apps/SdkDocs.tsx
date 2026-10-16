import React, { lazy } from 'react';
import { defineApp } from '@nex-os/sdk';

const SdkDocsApp = lazy(() => import('./SdkDocsApp'));

export default defineApp({
  id: 'sdk-docs',
  appId: 'sdk-docs',
  title: 'SDK Docs',
  icon: <span style={{ fontSize: 17 }}>⬡</span>,
  component: SdkDocsApp,
  description: 'Documentación interactiva de @nex-os/sdk',
  author: 'NEX',
  version: '0.2.0',
  pinToTaskbar: true,
  category: 'dev',
  aliases: ['sdk', 'nex-sdk', 'docs-sdk'],
  permissions: ['windows', 'settings', 'notifications'],
});
