import { Request, Response } from 'express';
import { MaintenanceService } from '../services/maintenance.service';

export const bookResource = async (req: Request, res: Response) => {
  try {
    const { resourceId } = req.params;
    const { durationHours } = req.body;

    const updatedResource = await MaintenanceService.incrementUsage(resourceId, durationHours);
    return res.status(200).json({ success: true, resource: updatedResource });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const completeMaintenance = async (req: Request, res: Response) => {
  try {
    const { resourceId } = req.params;
    const resetResource = await MaintenanceService.completeMaintenance(resourceId);
    return res.status(200).json({ success: true, resource: resetResource });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
