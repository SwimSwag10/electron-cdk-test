// cdk/stacks/api-stack.ts
import { Stack, StackProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { LambdaApiConstruct } from '../constructs/lambdaApiConstruct';

export class ApiStack extends Stack {
  public readonly lambdaApi: LambdaApiConstruct;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.lambdaApi = new LambdaApiConstruct(this, 'LambdaApiConstruct');
  }
}
