import React, { lazy } from 'react';
import { defineApp } from '@nex-os/sdk';

type HelloProps = {
  greet?: string;
};

const HelloNexApp = lazy(() => import('./HelloNexApp'));

export default defineApp<HelloProps>({
  id: 'hello-nex',
  appId: 'hello-nex',
  title: 'Hello NEX',
  icon: <span style={{ fontSize: 18 }}>🚀</span>,
  component: HelloNexApp,
  description: 'Plantilla tipada del SDK @nex-os/sdk 0.2',
  author: 'NEX',
  version: '0.2.0',
  pinToTaskbar: true,
  category: 'dev',
  aliases: ['hello', 'sdk-demo'],
  permissions: ['windows', 'settings', 'notifications'],
  defaultProps: { greet: 'Hello NEX' },
});
