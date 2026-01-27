/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import type { DragDropContextProps, EuiButtonEmptyProps } from '@elastic/eui';
import {
  EuiFormRow,
  EuiPanel,
  EuiButtonEmpty,
  EuiDraggable,
  EuiFlexGroup,
  EuiIcon,
  EuiButtonIcon,
  EuiFlexItem,
  useEuiTheme,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { Expression, type DraftGrokExpression, type GrokCollection } from '@kbn/grok-ui';
import { dynamic } from '@kbn/shared-ux-utility';
import { css } from '@emotion/react';
import { isEmpty } from 'lodash';
import { useGrokCollection, useGrokExpressions } from '@kbn/grok-ui';
import { SortableList } from '../../../../sortable_list';
import { useAIFeatures } from '../../../../../../../hooks/use_ai_features';

const GrokPatternAISuggestions = dynamic(() =>
  import('./grok_pattern_suggestion').then((mod) => ({ default: mod.GrokPatternAISuggestions }))
);

export const GrokPatternsEditor = () => {
  const {
    formState: { errors },
    setValue,
    watch,
  } = useFormContext();

  const { euiTheme } = useEuiTheme();

  const aiFeatures = useAIFeatures();

  const { grokCollection } = useGrokCollection();

  const { fields, append, remove, move } = useFieldArray({
    name: 'patterns' as 'patterns',
    rules: {
      minLength: 1,
      validate: (patterns) => {
        // Ensure patterns is an array of strings
        if (!Array.isArray(patterns) || patterns.length === 0) {
          return i18n.translate(
            'xpack.streams.streamDetailView.managementTab.enrichment.processor.grokEditorRequiredError',
            { defaultMessage: 'Empty patterns are not allowed.' }
          );
        }

        // Check if all patterns are empty strings
        const allEmpty = patterns.every((pattern) => {
          const patternStr = typeof pattern === 'string' ? pattern : '';
          return isEmpty(patternStr.trim());
        });

        if (allEmpty) {
          return i18n.translate(
            'xpack.streams.streamDetailView.managementTab.enrichment.processor.grokEditorRequiredError',
            { defaultMessage: 'Empty patterns are not allowed.' }
          );
        }

        return true;
      },
    },
  });

  // Watch the patterns array to get current string values
  const patternStrings = watch('patterns') as string[];

  // Convert string patterns to DraftGrokExpression instances
  const draftExpressions = useGrokExpressions(patternStrings || []);

  const handlePatternDrag: DragDropContextProps['onDragEnd'] = ({ source, destination }) => {
    if (source && destination) {
      move(source.index, destination.index);
    }
  };

  const handleAddPattern = () => {
    append('');
  };

  const getRemovePatternHandler = (id: number) => (fields.length > 1 ? () => remove(id) : null);

  const handlePatternChange = (newPattern: string, idx: number) => {
    setValue(`patterns.${idx}`, newPattern, {
      shouldValidate: true,
    });
  };

  return (
    <>
      <EuiFormRow
        label={i18n.translate(
          'xpack.streams.streamDetailView.managementTab.enrichment.processor.grokEditorLabel',
          { defaultMessage: 'Grok patterns' }
        )}
        css={css`
          margin-bottom: ${euiTheme.size.s};
        `}
        isInvalid={Boolean(errors.patterns)}
        error={errors.patterns?.root?.message as string}
      >
        <EuiPanel color="subdued" paddingSize="none">
          <SortableList onDragItem={handlePatternDrag}>
            {fields.map(
              (field, idx) =>
                draftExpressions[idx] && (
                  <DraggablePatternInput
                    key={field.id}
                    draggableId={field.id}
                    draftGrokExpression={draftExpressions[idx]}
                    idx={idx}
                    onRemove={getRemovePatternHandler(idx)}
                    grokCollection={grokCollection!}
                    onChange={(newPattern) => handlePatternChange(newPattern, idx)}
                  />
                )
            )}
          </SortableList>
        </EuiPanel>
      </EuiFormRow>
      {aiFeatures ? (
        <GrokPatternAISuggestions
          aiFeatures={aiFeatures}
          grokCollection={grokCollection!}
          setValue={setValue}
          onAddPattern={handleAddPattern}
        />
      ) : (
        <AddPatternButton onClick={handleAddPattern} />
      )}
    </>
  );
};

const AddPatternButton = (props: EuiButtonEmptyProps) => {
  return (
    <EuiButtonEmpty
      data-test-subj="streamsAppGrokPatternsEditorAddPatternButton"
      flush="left"
      size="s"
      {...props}
    >
      {i18n.translate(
        'xpack.streams.streamDetailView.managementTab.enrichment.processor.grokEditor.addPattern',
        { defaultMessage: 'Add pattern' }
      )}
    </EuiButtonEmpty>
  );
};

interface DraggablePatternInputProps {
  draggableId: string;
  draftGrokExpression: DraftGrokExpression;
  idx: number;
  grokCollection: GrokCollection;
  onChange: (pattern: string) => void;
  onRemove: ((idx: number) => void) | null;
}

const DraggablePatternInput = ({
  draggableId,
  draftGrokExpression,
  idx,
  grokCollection,
  onChange,
  onRemove,
}: DraggablePatternInputProps) => {
  return (
    <EuiDraggable
      index={idx}
      spacing="m"
      draggableId={draggableId}
      hasInteractiveChildren
      customDragHandle
    >
      {(provided) => (
        <EuiFormRow>
          <EuiFlexGroup gutterSize="s" responsive={false} alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiPanel
                color="transparent"
                paddingSize="s"
                {...provided.dragHandleProps}
                aria-label={i18n.translate(
                  'xpack.streams.streamDetailView.managementTab.enrichment.processor.grokEditor.dragHandleLabel',
                  { defaultMessage: 'Drag Handle' }
                )}
              >
                <EuiIcon type="grab" />
              </EuiPanel>
            </EuiFlexItem>
            <EuiFlexItem style={{ minWidth: 0 }}>
              <Expression
                draftGrokExpression={draftGrokExpression}
                grokCollection={grokCollection}
                dataTestSubj="streamsAppPatternExpression"
                onChange={onChange}
              />
            </EuiFlexItem>
            {onRemove && (
              <EuiButtonIcon
                data-test-subj="streamsAppDraggablePatternInputButton"
                iconType="minusInCircle"
                color="danger"
                onClick={() => onRemove(idx)}
                aria-label={i18n.translate(
                  'xpack.streams.streamDetailView.managementTab.enrichment.processor.grokEditor.removePattern',
                  { defaultMessage: 'Remove grok pattern' }
                )}
              />
            )}
          </EuiFlexGroup>
        </EuiFormRow>
      )}
    </EuiDraggable>
  );
};
