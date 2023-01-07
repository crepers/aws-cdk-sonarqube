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
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sd from 'aws-cdk-lib/aws-servicediscovery';
import * as iam from 'aws-cdk-lib/aws-iam';

import * as base from '../../lib/template/stack/base/base-stack';
import { AppContext } from '../../lib/template/app-context';
import { PrivateDnsNamespace } from 'aws-cdk-lib/aws-servicediscovery';


export class VpcInfraStack extends base.BaseStack {
    constructor(appContext: AppContext, stackConfig: any) {
        super(appContext, stackConfig);

        // VPC
        const vpc = this.createVpc(
            this.stackConfig.VPCName,
            this.stackConfig.VPCMaxAzs,
            this.stackConfig.VPCCIDR,
            this.stackConfig.NATGatewayCount);
        this.putVariable('VpcName', `${this.stackName}/${this.stackConfig.VPCName}`)

        // Default Security Group
        const frontendSG = this.createFrontendSecurityGroups(vpc);
        const backendSG = this.createBackendSecurityGroups(vpc, frontendSG);
        this.createDatabaseSecurityGroups(vpc, backendSG);
    }

    /**
     * Create a SG for a web server
     * @param vpc VPC
     * @returns Web Server(Frontend) Security Group
     */
    private createFrontendSecurityGroups(vpc: ec2.IVpc): ec2.SecurityGroup {
        const webserverSG = new ec2.SecurityGroup(this, 'web-server-sg', {
            vpc: vpc,
            allowAllOutbound: true,
            description: 'security group for a web server',
        });

        webserverSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(80),
            'allow HTTP traffic from anywhere',
        );

        webserverSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(443),
            'allow HTTPS traffic from anywhere',
        );

        // webserverSG.addIngressRule(
        //     ec2.Peer.ipv4('123.123.123.123/16'),
        //     ec2.Port.allIcmp(),
        //     'allow ICMP traffic from a specific IP range',
        // );

        this.putVariable('WebserverSG', webserverSG.securityGroupId);

        return webserverSG;
    }

    /**
     * Create a SG for a backend server
     * @param vpc VPC
     * @param webserverSG WebServer(Frontend) Security Group
     * @returns Backend(WAS) Security Group
     */
    private createBackendSecurityGroups(vpc: ec2.IVpc, webserverSG: ec2.SecurityGroup): ec2.SecurityGroup {
        const backendServerSG = new ec2.SecurityGroup(this, 'backend-server-sg', {
            vpc: vpc,
            allowAllOutbound: true,
            description: 'security group for a backend server',
        });
        backendServerSG.connections.allowFrom(
            new ec2.Connections({
                securityGroups: [webserverSG],
            }),
            ec2.Port.tcp(80),
            'allow traffic on port 80 from the webserver security group',
        );
        backendServerSG.connections.allowFrom(
            new ec2.Connections({
                securityGroups: [webserverSG],
            }),
            ec2.Port.tcp(8080),
            'allow traffic on port 8080 from the webserver security group',
        );
        this.putVariable('BackendServerSG', backendServerSG.securityGroupId);

        return backendServerSG;
    }

    /**
     * Create a SG for a database server
     * @param vpc VPC
     * @param backendServerSG Backend(WAS) Security Group
     * @returns Database Security Group
     */
    private createDatabaseSecurityGroups(vpc: ec2.IVpc, backendServerSG: ec2.SecurityGroup): ec2.SecurityGroup {
        const dbserverSG = new ec2.SecurityGroup(this, 'database-server-sg', {
            vpc: vpc,
            allowAllOutbound: true,
            description: 'security group for a database server',
        });

        dbserverSG.connections.allowFrom(
            new ec2.Connections({
                securityGroups: [backendServerSG],
            }),
            ec2.Port.tcp(3306),
            'allow traffic on port 3306 from the backend server security group',
        );

        this.putVariable('DbserverSG', dbserverSG.securityGroupId);
        return dbserverSG;
    }

    private createVpc(baseName: string, vpcMaxAzs: number, vpcCidr: string, natGateways: number): ec2.IVpc {
        if (vpcMaxAzs > 0 && vpcCidr.length > 0) {
            const vpc = new ec2.Vpc(this, baseName,
                {
                    maxAzs: vpcMaxAzs,
                    cidr: vpcCidr,
                    natGateways: natGateways,

                    subnetConfiguration: [{
                        cidrMask: 24,   // 256
                        name: 'NET',
                        subnetType: ec2.SubnetType.PUBLIC,
                    }, {
                        cidrMask: 20,
                        name: 'WAS',
                        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
                        // }, {
                        //     cidrMask: 22,
                        //     name: 'CHATBOT',
                        //     subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
                        // }, {
                        //     cidrMask: 24,
                        //     name: 'SEARCH',
                        //     subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
                    }, {
                        cidrMask: 24,
                        name: 'RDS',
                        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    }]
                });

            return vpc;
        } else {
            console.error('please check the options: VPCMaxAzs, VPCCIDR, NATGateway');
            process.exit(1)
        }
    }
}
