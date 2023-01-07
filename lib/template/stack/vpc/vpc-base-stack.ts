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

import * as base from '../base/base-stack';
import { AppContext } from '../../app-context';


export interface VpcLegacyLookupProps {
    vpcIdLegacy?: string;
    vpcNameLegacy?: string;

    webserverSG?: string;
    backendServerSG?: string;
    dbserverSG?: string;
}

export abstract class VpcBaseStack extends base.BaseStack {
    private baseVpc?: ec2.IVpc;
    protected webserverSG: ec2.ISecurityGroup;
    protected backendServerSG: ec2.ISecurityGroup;
    protected dbserverSG: ec2.ISecurityGroup;

    abstract onLookupLegacyVpc(): VpcLegacyLookupProps | undefined;
    abstract onPostConstructor(baseVpc?: ec2.IVpc): void;

    constructor(appContext: AppContext, stackConfig: any) {
        super(appContext, stackConfig);

        const props = this.onLookupLegacyVpc();

        if (props != undefined) {
            this.baseVpc = this.importVpc(props);
        } else {
            this.baseVpc = undefined;
        }

        this.onPostConstructor(this.baseVpc);
    }

    protected importVpc(props: VpcLegacyLookupProps): ec2.IVpc {
        if (props.vpcIdLegacy != undefined && props.vpcIdLegacy.length > 0) {
            const vpc = ec2.Vpc.fromLookup(this, `BaseVPC`, {
                vpcId: props.vpcIdLegacy,
            });

            this.getSecurityGroups(props, vpc);
            return vpc;
        } else if (props.vpcNameLegacy != undefined && props.vpcNameLegacy.length > 0) {
            const vpc = ec2.Vpc.fromLookup(this, `BaseVPC`, {
                vpcName: props.vpcNameLegacy
            });

            this.getSecurityGroups(props, vpc);
            return vpc;
        } else {
            console.error('please check VPC import options: VPCID or VPCName is essential.');
            process.exit(1)
        }
    }

    protected getSecurityGroups(props: VpcLegacyLookupProps, vpc: ec2.IVpc) {
        if(props.webserverSG) {
            this.webserverSG = ec2.SecurityGroup.fromSecurityGroupId(this, "WebserverSG", props.webserverSG);
        } else {
            this.webserverSG = new ec2.SecurityGroup(this, 'web-server-sg', {
                vpc: vpc,
                allowAllOutbound: true,
                description: 'security group for a web server',
            });
            this.webserverSG.addIngressRule(
                ec2.Peer.anyIpv4(),
                ec2.Port.tcp(80),
                'allow HTTP traffic from anywhere',
            );
            this.webserverSG.addIngressRule(
                ec2.Peer.anyIpv4(),
                ec2.Port.tcp(443),
                'allow HTTPS traffic from anywhere',
            );
        }

        if(props.backendServerSG) {
            this.backendServerSG = ec2.SecurityGroup.fromSecurityGroupId(this, "BackendServerSG", props.backendServerSG);
        } else {
            this.backendServerSG = new ec2.SecurityGroup(this, 'backend-server-sg', {
                vpc: vpc,
                allowAllOutbound: true,
                description: 'security group for a backend server',
            });

            this.backendServerSG.connections.allowFrom(
                new ec2.Connections({
                    securityGroups: [this.webserverSG],
                }),
                ec2.Port.tcp(80),
                'allow traffic on port 80 from the webserver security group',
            );

            this.backendServerSG.connections.allowFrom(
                new ec2.Connections({
                    securityGroups: [this.webserverSG],
                }),
                ec2.Port.tcp(8080),
                'allow traffic on port 8080 from the webserver security group',
            );
        }

        if(props.dbserverSG) {
            this.dbserverSG = ec2.SecurityGroup.fromSecurityGroupId(this, "DbserverSG", props.dbserverSG);
        } else {
            this.dbserverSG = new ec2.SecurityGroup(this, 'database-server-sg', {
                vpc: vpc,
                allowAllOutbound: true,
                description: 'security group for a database server',
            });
    
            this.dbserverSG.connections.allowFrom(
                new ec2.Connections({
                    securityGroups: [this.backendServerSG],
                }),
                ec2.Port.tcp(3306),
                'allow traffic on port 3306 from the backend server security group',
            );
        }
    }

    protected createVpc(baseName: string, vpcMaxAzs: number, vpcCidr: string, natGateways: number): ec2.IVpc {
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
