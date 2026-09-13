import { Injectable } from '@nestjs/common';
import type { SensitivityResult } from '@fijaprecio/shared-types';
import { CostingService } from './costing.service.js';
import { analyzeSensitivity } from './sensitivity.js';

@Injectable()
export class SensitivityService {
  constructor(private readonly costing: CostingService) {}

  async analyzeForProduct(orgId: string, productId: string): Promise<SensitivityResult> {
    const { engineInput, engineConfig, marketMedians, marketSampleLinks } =
      await this.costing.prepare(orgId, productId);
    const result = analyzeSensitivity(engineInput, engineConfig, marketMedians, marketSampleLinks);
    return { ...result, computedAt: new Date().toISOString() };
  }
}
