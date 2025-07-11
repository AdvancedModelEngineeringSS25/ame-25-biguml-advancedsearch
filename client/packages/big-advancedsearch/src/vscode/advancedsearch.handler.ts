/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import {
    EXPERIMENTAL_TYPES,
    TYPES,
    type ActionDispatcher,
    type ActionListener,
    type Disposable,
    type ExperimentalGLSPServerModelState
} from '@borkdominik-biguml/big-vscode-integration/vscode';

import { DisposableCollection } from '@eclipse-glsp/protocol';
import { inject, injectable, postConstruct } from 'inversify';
import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';

import type { SearchResult } from '../common/searchresult.js';
import type { IMatcher } from './matchers/IMatcher.js';

import { SelectAllAction } from '@eclipse-glsp/protocol';
import { SelectAction } from '@eclipse-glsp/vscode-integration';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';

import { ClassDiagramMatcher } from './matchers/classmatcher.js';
import { CommunicationDiagramMatcher } from './matchers/communicationmatcher.js';
//import { DeploymentDiagramMatcher } from './matchers/deploymentmatcher.js';
import { ActivityDiagramMatcher } from './matchers/activitymatcher.js';
import { InformationFlowDiagramMatcher } from './matchers/informationflowmatcher.js';
import { PackageDiagramMatcher } from './matchers/packagematcher.js';
import { StateMachineDiagramMatcher } from './matchers/statemachinematcher.js';
import { UseCaseDiagramMatcher } from './matchers/usecasematcher.js';

@injectable()
export class AdvancedSearchActionHandler implements Disposable {
    @inject(TYPES.ActionDispatcher)
    protected readonly actionDispatcher: ActionDispatcher;

    @inject(TYPES.ActionListener)
    protected readonly actionListener: ActionListener;

    @inject(EXPERIMENTAL_TYPES.GLSPServerModelState)
    protected readonly modelState: ExperimentalGLSPServerModelState;

    private readonly toDispose = new DisposableCollection();

    private readonly matchers: IMatcher[] = [
        new ClassDiagramMatcher(),
        new UseCaseDiagramMatcher(),
        new PackageDiagramMatcher(),
        new InformationFlowDiagramMatcher(),
        new CommunicationDiagramMatcher(),
        new StateMachineDiagramMatcher(),
        new ActivityDiagramMatcher()
        // new DeploymentDiagramMatcher()
    ];

    @postConstruct()
    protected init(): void {
        this.toDispose.push(
            this.actionListener.handleVSCodeRequest<RequestAdvancedSearchAction>(RequestAdvancedSearchAction.KIND, request => {
                const model = this.modelState.getModelState();

                const results: SearchResult[] = [];

                if (model) {
                    const sourceModel = model.getSourceModel();
                    console.log('The model: ', sourceModel);
                    const query = request.action.query.trim().toLowerCase();
                    const [rawType, rawPattern] = query.split(':');
                    const type = rawType?.trim();
                    const pattern = rawPattern?.trim();

                    const applicableMatchers = !type ? this.matchers : this.matchers.filter(m => m.supportsPartial?.(type));

                    for (const matcher of applicableMatchers) {
                        results.push(...matcher.match(model));
                    }

                    const filtered = results.filter(item => {
                        const matchesType = !type || item.type.toLowerCase().includes(type);
                        const matchesPattern = !pattern || item.name.toLowerCase().includes(pattern);
                        return matchesType && matchesPattern;
                    });

                    const unique = new Map<string, SearchResult>();
                    for (const item of filtered) {
                        unique.set(`${item.id}-${item.type}`, item);
                    }

                    return AdvancedSearchActionResponse.create({ results: Array.from(unique.values()) });
                }

                return AdvancedSearchActionResponse.create({ results: [] });
            }),

            this.actionListener.handleVSCodeRequest<RequestHighlightElementAction>(RequestHighlightElementAction.KIND, message => {
                const uri = message.action.semanticUri;
                this.actionDispatcher.dispatch(SelectAllAction.create(false));
                this.actionDispatcher.dispatch(SelectAction.create({ selectedElementsIDs: [uri] }));
                return HighlightElementActionResponse.create({ ok: true });
            })
        );
    }

    dispose(): void {
        this.toDispose.dispose();
    }
}
