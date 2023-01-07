/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import * as cfn_inc from 'aws-cdk-lib/cloudformation-include';

import * as base from '../base/base-stack';
import { AppContext } from '../../app-context';


export interface CfnTemplateProps {
    templatePath: string;
    parameters?: any;
}

export abstract class CfnIncludeStack extends base.BaseStack {
    private cfnTemplate?: cfn_inc.CfnInclude;

    abstract onLoadTemplateProps(): CfnTemplateProps | undefined;
    abstract onPostConstructor(cfnTemplate?: cfn_inc.CfnInclude): void;

    constructor(appContext: AppContext, stackConfig: any) {
        super(appContext, stackConfig);

        const props = this.onLoadTemplateProps();

        if (props != undefined) {
            this.cfnTemplate = this.loadTemplate(props);
        } else {
            this.cfnTemplate = undefined;
        }

        this.onPostConstructor(this.cfnTemplate);
    }

    private loadTemplate(props: CfnTemplateProps): cfn_inc.CfnInclude {
        const cfnTemplate = new cfn_inc.CfnInclude(this, 'cfn-template', {
            templateFile: props.templatePath,
        });

        if (props.parameters != undefined) {
            for(let param of props.parameters) {
                const paramEnv = cfnTemplate.getParameter(param.Key);
                paramEnv.default = param.Value;
            }
        }

        return cfnTemplate;
    }
}
