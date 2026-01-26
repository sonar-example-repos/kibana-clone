/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiSpacer, EuiText } from '@elastic/eui';
import { UseField } from '@kbn/es-ui-shared-plugin/static/forms/hook_form_lib';
import { fieldValidators } from '@kbn/es-ui-shared-plugin/static/forms/helpers';
import { TextField } from '@kbn/es-ui-shared-plugin/static/forms/components';
import type { ActionConnectorFieldsProps } from '@kbn/triggers-actions-ui-plugin/public';
import { i18n } from '@kbn/i18n';

/**
 * GitHub-branded form component for Data Sources edit flow.
 *
 * This form shows a simplified GitHub interface (just token) while hiding
 * MCP implementation details. The backend still uses .mcp connector type -
 * this is UI-only branding to improve user experience.
 */
const GitHubDataSourceForm: React.FC<ActionConnectorFieldsProps> = ({ readOnly }) => {
  const { emptyField } = fieldValidators;

  return (
    <>
      <EuiText size="s" color="subdued">
        <p>
          {i18n.translate('xpack.dataSources.githubForm.description', {
            defaultMessage:
              'Connect to GitHub using a personal access token with appropriate permissions.',
          })}
        </p>
      </EuiText>
      <EuiSpacer size="m" />

      <EuiFlexGroup direction="column" gutterSize="m">
        <EuiFlexItem>
          <UseField
            path="secrets.token"
            component={TextField}
            config={{
              label: i18n.translate('xpack.dataSources.githubForm.tokenLabel', {
                defaultMessage: 'Personal Access Token',
              }),
              helpText: i18n.translate('xpack.dataSources.githubForm.tokenHelpText', {
                defaultMessage:
                  'GitHub Personal Access Token, OAuth token, or GitHub Copilot token. ' +
                  'Do not include "Bearer" prefix - it will be added automatically.',
              }),
              validations: [
                {
                  validator: emptyField(
                    i18n.translate('xpack.dataSources.githubForm.tokenRequired', {
                      defaultMessage: 'Token is required',
                    })
                  ),
                },
              ],
            }}
            componentProps={{
              euiFieldProps: {
                type: 'password',
                readOnly,
                'data-test-subj': 'github-datasource-token-input',
              },
            }}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
};

// eslint-disable-next-line import/no-default-export
export { GitHubDataSourceForm as default };
