#!/usr/bin/env node
import { AppContext, AppContextError } from '../lib/template/app-context';

import { VpcInfraStack } from './common-infra/vpc-infra-stack';
import { SonarQubeStack } from './services/stacks/devops/sonarqube-stack';
import { CdkCicdStack } from './services/stacks/devops/cdk-cicd-stack';
import { DevSecOpsStack } from './services/stacks/devops/devsecops-stack';
import { RepoStack } from './services/stacks/devops/repo-stack';

try {
    const appContext = new AppContext({
        appConfigFileKey: 'APP_CONFIG',
    });

    // 1. VPC Stack
    new VpcInfraStack(appContext, appContext.appConfig.Stack.VpcInfra);

    // 2. Sonarqube Stack
    new SonarQubeStack(appContext, appContext.appConfig.Stack.SonarQube);

    // 3. Repository Stack
    new RepoStack(appContext, appContext.appConfig.Stack.Repository);

    // 4. SAST Stack
    new DevSecOpsStack(appContext, appContext.appConfig.Stack.DevSecOps);

    // CDK Stack(optional)
    //new CdkCicdStack(appContext, appContext.appConfig.Stack.DevOps);
    
} catch (error) {
    if (error instanceof AppContextError) {
        console.error('[AppContextError]:', error.message);
    } else {
        console.error('[Error]: not-handled-error', error);
    }
}
