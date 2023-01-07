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

import * as base from '../../base/ecs-base-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sd from 'aws-cdk-lib/aws-servicediscovery'

import { Override } from '../../../../lib/template/stack/base/base-stack';
import { AppContext } from '../../../../lib/template/app-context';
import { SonarQubeConstrunct } from '../../construct/devops/sonarqube-const';


export class SonarQubeStack extends base.EcsBaseStack {
    constructor(appContext: AppContext, stackConfig: any) {
        super(appContext, stackConfig);
      }
  
      @Override
      onEcsPostConstructor(vpc: ec2.IVpc, cluster: ecs.ICluster, backendServerSG: ec2.ISecurityGroup) {
        new SonarQubeConstrunct(this, 'SonarQube', {
          stackName: this.stackName,
          projectPrefix: this.projectPrefix,
          env: this.commonProps.env!,
          stackConfig: this.stackConfig,
          variables: this.commonProps.variables,

          cpu: this.stackConfig.Cpu,
          memoryMiB: this.stackConfig.MemoryMiB,
          imageTag: this.stackConfig.ImageTag,
          vpc: vpc,
        });
    }
}
