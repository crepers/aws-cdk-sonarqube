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
import * as codecommit from 'aws-cdk-lib/aws-codecommit';

import * as base from '../../../../lib/template/stack/base/base-stack';
import { AppContext } from '../../../../lib/template/app-context';
import { CreateScanProjectAndRunOnCommit } from '../../construct/devops/sonarqube-const';

/**
 * CDK SAST를 위한 Repository 생성과 AWS CodeBuild 연동
 */
export class CdkCicdStack extends base.BaseStack {
    constructor(appContext: AppContext, stackConfig: any) {
        super(appContext, stackConfig);

        const gitRepo = new codecommit.Repository(this, 'cdk-git' ,{
            repositoryName: `${this.projectPrefix}-cdk`
        });

        if(this.stackConfig.SonarQube) {
            CreateScanProjectAndRunOnCommit(this, stackConfig.Name, gitRepo, stackConfig.SonarQube, `${this.projectPrefix}-SonarqubeAPIEndpoint`);
        }
    }
}
