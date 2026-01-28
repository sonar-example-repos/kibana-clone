/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// This is a packaged standalone version of console that needs to import browser code
/* eslint-disable @kbn/imports/no_boundary_crossing */

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { noop } from 'lodash';
import { EMPTY } from 'rxjs';
import type { IToasts, Toast } from '@kbn/core-notifications-browser';
import { monaco } from '@kbn/monaco';

// Disable Monaco workers entirely, in case monaco ever decides to spawn any for some reason.
// Console doesnt use any of the monaco features that require workers, since we provide
// our own language tokenizer and autocompletion provider.
const noopWorker = {
  postMessage: noop,
  addEventListener: noop,
  removeEventListener: noop,
  terminate: noop,
  onerror: null,
  onmessage: null,
  onmessageerror: null,
} as unknown as Worker;

window.MonacoEnvironment = {
  monaco,
  getWorker: (_workerId: string, _label: string) => noopWorker,
};

import { __IntlProvider as IntlProvider } from '@kbn/i18n-react';

import { DocLinksService } from '@kbn/core-doc-links-browser-internal';
import type { CoreContext } from '@kbn/core-base-browser-internal';

import { HttpService } from '@kbn/core-http-browser-internal';
import { ExecutionContextService } from '@kbn/core-execution-context-browser-internal';
import { FatalErrorsService } from '@kbn/core-fatal-errors-browser-internal';
import { AnalyticsService } from '@kbn/core-analytics-browser-internal';
import { ThemeService } from '@kbn/core-theme-browser-internal';
import { I18nService } from '@kbn/core-i18n-browser-internal';
import { i18n } from '@kbn/i18n';
import type { ApplicationStart, CoreStart, HttpSetup, NotificationsSetup } from '@kbn/core/public';
import type { DataPublicPluginStart } from '@kbn/data-plugin/public';
import type { LicensingPluginStart } from '@kbn/licensing-plugin/public';
import { createStorage, createHistory, createSettings, setStorage } from '../../public/services';
import { loadActiveApi } from '../../public/lib/kb';

import { createPackagingParsedRequestsProvider } from './parser';
import { injectedMetadata, coreContext, trackUiMetric } from './services';

import * as localStorageObjectClient from '../../public/lib/local_storage_object_client';
import { Main } from '../../public/application/containers';

import {
  ServicesContextProvider,
  EditorContextProvider,
  RequestContextProvider,
} from '../../public/application/contexts';
import { createApi, createEsHostService } from '../../public/application/lib';
import { AutocompleteInfo, setAutocompleteInfo } from '../../public/services';
import type { OneConsoleProps } from './types';

// Translation files are generated during the build process
/* eslint-disable @kbn/imports/no_unresolvable_imports */
const translations = {
  en: {
    formats: {},
    messages: {},
  },
  'fr-FR': require('./translations/fr-FR.json'),
  'ja-JP': require('./translations/ja-JP.json'),
  'zh-CN': require('./translations/zh-CN.json'),
  'de-DE': require('./translations/de-DE.json'),
};
/* eslint-enable @kbn/imports/no_unresolvable_imports */

interface ServicesRefValue {
  http: HttpSetup;
  docLinks: ReturnType<DocLinksService['start']>;
  theme: ReturnType<ThemeService['setup']>;
  i18nService: I18nService;
  storage: ReturnType<typeof createStorage>;
  storageHistory: ReturnType<typeof createHistory>;
  settings: ReturnType<typeof createSettings>;
  objectStorageClient: ReturnType<typeof localStorageObjectClient.create>;
  esHostService: ReturnType<typeof createEsHostService>;
  autocompleteInfo: AutocompleteInfo;
}

export const OneConsole = ({
  lang = 'en',
  http: customHttp,
  notifications: customNotifications,
}: OneConsoleProps) => {
  const [apiLoaded, setApiLoaded] = useState(false);

  // Get the translations for the selected language, fallback to English
  const selectedTranslations = translations[lang] || translations.en;

  // Configure the global @kbn/i18n system with the same translations
  i18n.init({
    locale: lang,
    formats: selectedTranslations.formats,
    messages: selectedTranslations.messages,
  });

  // Create all services once using useRef as they should never be recreated
  const servicesRef = useRef<ServicesRefValue | null>(null);

  if (!servicesRef.current) {
    const docLinksService = new DocLinksService(coreContext as CoreContext);
    docLinksService.setup();
    const docLinks = docLinksService.start({ injectedMetadata });

    const i18nService = new I18nService();

    const themeService = new ThemeService();
    const theme = themeService.setup({ injectedMetadata });

    const analyticsService = new AnalyticsService(coreContext as CoreContext);
    const analytics = analyticsService.setup({ injectedMetadata });

    const rootDomElement = document.getElementById('root');
    if (!rootDomElement) {
      throw new Error('Expected #root element to exist');
    }
    const fatalErrorsService = new FatalErrorsService(rootDomElement, () => {
      // eslint-disable-next-line no-console
      console.log('FATAL ERROR OCURRED');
    });
    const fatalErrors = fatalErrorsService.setup({
      injectedMetadata,
      analytics,
      theme,
      i18n: i18nService.getContext(),
    });

    const executionContextService = new ExecutionContextService();
    const executionContext = executionContextService.setup({ analytics });

    const httpService = new HttpService();
    const originalHttp = httpService.setup({
      injectedMetadata,
      fatalErrors,
      executionContext,
    });

    const http = { ...originalHttp, ...customHttp } as unknown as HttpSetup;

    const storage = createStorage({
      engine: window.localStorage,
      prefix: 'sense:',
    });
    setStorage(storage);

    const storageHistory = createHistory({ storage });
    const settings = createSettings({ storage });
    const objectStorageClient = localStorageObjectClient.create(storage);
    const api = createApi({ http });
    const esHostService = createEsHostService({ api });

    // Initialize autocompleteInfo like in the plugin
    const autocompleteInfo = new AutocompleteInfo();
    autocompleteInfo.setup(http);
    autocompleteInfo.mapping.setup(http, settings);
    // Initialize autocomplete
    setAutocompleteInfo(autocompleteInfo);

    servicesRef.current = {
      http,
      docLinks,
      theme,
      i18nService,
      storage,
      storageHistory,
      settings,
      objectStorageClient,
      esHostService,
      autocompleteInfo,
    };
  }

  const {
    http,
    docLinks,
    theme,
    i18nService,
    storage,
    storageHistory,
    settings,
    objectStorageClient,
    esHostService,
    autocompleteInfo,
  } = servicesRef.current;

  // Use the custom notifications provided by the consumer
  const notifications: Pick<NotificationsSetup, 'toasts'> = useMemo(() => {
    const createToast = (): Toast => ({ id: 'packaged-console-toast' });

    const toasts: IToasts = {
      get$: () => EMPTY,
      add: customNotifications.add ?? (() => createToast()),
      remove: customNotifications.remove ?? (() => undefined),
      addInfo: customNotifications.addInfo ?? (() => createToast()),
      addSuccess: customNotifications.addSuccess ?? (() => createToast()),
      addWarning: customNotifications.addWarning ?? (() => createToast()),
      addDanger: customNotifications.addDanger ?? (() => createToast()),
      addError: customNotifications.addError ?? (() => createToast()),
    };

    return { toasts };
  }, [customNotifications]);

  useEffect(() => {
    const loadApi = async () => {
      try {
        await loadActiveApi(http);
        setApiLoaded(true);
      } catch (_error: unknown) {
        setApiLoaded(true);
      }
    };

    loadApi();
  }, [http]);

  // Don't render until API is loaded
  if (!apiLoaded) {
    return null;
  }

  return (
    <IntlProvider locale={lang} messages={selectedTranslations.messages}>
      <ServicesContextProvider
        value={{
          analytics: {
            reportEvent: () => {},
          },
          i18n: i18nService.getContext(),
          theme: {
            theme$: theme.theme$,
          },
          userProfile: {
            getUserProfile$: () => ({ pipe: () => ({ subscribe: () => {} }) }),
            userProfile: null,
          } as unknown as CoreStart['userProfile'],
          docLinkVersion: docLinks.DOC_LINK_VERSION,
          docLinks: docLinks.links,
          services: {
            esHostService,
            storage,
            history: storageHistory,
            settings,
            notifications,
            trackUiMetric,
            objectStorageClient,
            http,
            autocompleteInfo,
            data: {} as unknown as DataPublicPluginStart,
            licensing: {} as unknown as LicensingPluginStart,
            application: {} as unknown as ApplicationStart,
          },
          config: {
            isDevMode: false,
            isPackagedEnvironment: true,
          },
        }}
      >
        <RequestContextProvider>
          <EditorContextProvider
            settings={settings.toJSON()}
            customParsedRequestsProvider={createPackagingParsedRequestsProvider()}
          >
            <div className="kbnConsole">
              <Main />
            </div>
          </EditorContextProvider>
        </RequestContextProvider>
      </ServicesContextProvider>
    </IntlProvider>
  );
};
