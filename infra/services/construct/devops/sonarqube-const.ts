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
import { Construct } from 'constructs';
import { Peer, Port, SecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, Compatibility, ContainerImage, LogDriver, Secret, TaskDefinition, UlimitName } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { AuroraPostgresEngineVersion, Credentials, DatabaseClusterEngine, ServerlessCluster } from 'aws-cdk-lib/aws-rds';
import { aws_codebuild, aws_events_targets } from "aws-cdk-lib";
import { BuildEnvironmentVariableType } from "aws-cdk-lib/aws-codebuild";

import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as base from '../../../../lib/template/construct/base/base-construct';

/**
 * Example parameters
  cpu: 1024,
  memoryMiB: 2048,
  imageTag: 'community',

  Initial Admin account : admin	admin
 */
export interface SonarQubeStackProp extends base.ConstructCommonProps {
  /**
   * The number of cpu units used by the task.
   *
   * 256 (.25 vCPU) - Available memory values: 512 (0.5 GB), 1024 (1 GB), 2048 (2 GB)
   * 512 (.5 vCPU) - Available memory values: 1024 (1 GB), 2048 (2 GB), 3072 (3 GB), 4096 (4 GB)
   * 1024 (1 vCPU) - Available memory values: 2048 (2 GB), 3072 (3 GB), 4096 (4 GB), 5120 (5 GB), 6144 (6 GB), 7168 (7 GB), 8192 (8 GB)
   * 2048 (2 vCPU) - Available memory values: Between 4096 (4 GB) and 16384 (16 GB) in increments of 1024 (1 GB)
   * 4096 (4 vCPU) - Available memory values: Between 8192 (8 GB) and 30720 (30 GB) in increments of 1024 (1 GB)
   *
   * @default 1024
   */
  cpu?: number;
  /**
   * The amount (in MiB) of memory used by the task.
   *
   * @default 2048
   */
  memoryMiB?: number;
  /**
   * The tag name of sonarqube
   *
   * @default community
   */
  imageTag?: string;

  vpc: IVpc,
}

export class SonarQubeConstrunct extends base.BaseConstruct {
  constructor(scope: Construct, id: string, props: SonarQubeStackProp) {
    super(scope, id, props);

    let { cpu, memoryMiB, imageTag } = props;

    cpu = cpu ?? 1024;
    memoryMiB = memoryMiB ?? 2048;
    imageTag = imageTag ?? 'community';

    const defaultDatabaseName = 'sonarqube';

    const vpc = props.vpc;
    const cluster = new Cluster(this, 'cluster', {
      vpc,
    });

    const sg = new SecurityGroup(this, 'sonarqube-sg', {
      vpc,
      allowAllOutbound: true,
      description: 'Aurora Security Group',
    });
    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(5432), 'SonarDBAurora');

    const aurora = new ServerlessCluster(this, 'aurora-cluster', {
      vpc,
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_18,
      }),
      credentials: Credentials.fromGeneratedSecret('postgres'),
      defaultDatabaseName: defaultDatabaseName,
      securityGroups: [sg],
    });

    const taskDefinition = new TaskDefinition(this, 'sonarqube-task', {
      compatibility: Compatibility.EC2_AND_FARGATE,
      cpu: `${cpu}`,
      memoryMiB: `${memoryMiB}`,
    });

    taskDefinition.addContainer('sonarqube', {
      image: ContainerImage.fromRegistry(`public.ecr.aws/docker/library/sonarqube:${imageTag}`),
      memoryLimitMiB: memoryMiB,
      command: ['-Dsonar.search.javaAdditionalOpts=-Dnode.store.allow_mmap=false'],
      logging: LogDriver.awsLogs({
        streamPrefix: 'sonarqube',
      }),
      portMappings: [
        {
          containerPort: 9000,
        },
      ],
      secrets: {
        'sonar.jdbc.password': Secret.fromSecretsManager(aurora.secret!, 'password'),
        'sonar.jdbc.username': Secret.fromSecretsManager(aurora.secret!, 'username'),
      },
      environment: {
        'sonar.jdbc.url': `jdbc:postgresql://${aurora.clusterEndpoint.socketAddress}/${defaultDatabaseName}`,
      },
    });

    taskDefinition.defaultContainer?.addUlimits(
      {
        name: UlimitName.NOFILE,
        softLimit: 65536,
        hardLimit: 65536,
      },
    );

    const service = new ApplicationLoadBalancedFargateService(this, 'sonarqube-service', {
      cluster,
      taskDefinition,
      publicLoadBalancer: true,
      desiredCount: 1,
    });
    
    this.exportOutput('SonarqubeAPIEndpoint', `http://${service.loadBalancer.loadBalancerDnsName}`);
    this.putParameter("SonarqubeAPIEndpoint", `http://${service.loadBalancer.loadBalancerDnsName}`);
    
  }  
}

export function CreateScanProjectAndRunOnCommit(scope: Construct, stackName: string, gitRepo: codecommit.IRepository, sonarqube: any, paramKey: string): codebuild.Project {
  const project = new codebuild.Project(scope, `${stackName}ScanBuild`, {
    projectName: `${stackName}Scan`,
    source: aws_codebuild.Source.codeCommit({
      repository: gitRepo,
      branchOrRef: "refs/heads/master",
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
      computeType: codebuild.ComputeType.SMALL,
      privileged: true
    },
    environmentVariables: {
      SONAR_HOST: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: ssm.StringParameter.valueForStringParameter(
          scope,
          paramKey
        )
      },
      SONAR_PROJECT_KEY: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: sonarqube.SONAR_PROJECT_KEY,
      },
      // https://sonarqubekr.atlassian.net/wiki/spaces/SON/pages/427258
      SONAR_TOKEN: {
        type: BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: sonarqube.SONAR_TOKEN_ARN,
      },
    },
    buildSpec: codebuild.BuildSpec.fromObject({
      "version": "0.2",
      "phases": {
        "build": {
          "commands": [
            "npx sonarqube-scanner -Dsonar.projectKey=$SONAR_PROJECT_KEY -Dsonar.sources=. -Dsonar.host.url=$SONAR_HOST -Dsonar.login=$SONAR_TOKEN",
          ]
        }
      },
    }),
  });

  gitRepo.onCommit("onCommit", {
    branches: ["master"],
    target: new aws_events_targets.CodeBuildProject(project)
  });

  return project;
}
