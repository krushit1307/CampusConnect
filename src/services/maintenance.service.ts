import { Resource } from '../models/Resource';
import { Task } from '../models/Task';

export class MaintenanceService {
  static async incrementUsage(resourceId: string, durationHours: number = 1) {
    const resource = await Resource.findById(resourceId);
    if (!resource) throw new Error('Resource not found');

    if (resource.status === 'needs_maintenance') {
      throw new Error('Cannot use resource. Maintenance required.');
    }

    resource.usageCount += 1;
    resource.usageDurationHours += durationHours;

    // Check if threshold is crossed
    if (resource.usageCount >= resource.maintenanceInterval) {
      resource.status = 'needs_maintenance';

      // Auto-generate high-priority Task for Student Union
      await Task.create({
        title: `Service Required: ${resource.name} (${resource.usageCount} cycles reached)`,
        description: `The hardware asset has reached its maintenance threshold of ${resource.maintenanceInterval} usage cycles and has been automatically locked.`,
        priority: 'urgent',
        resourceId: resource._id,
      });
    }

    await resource.save();
    return resource;
  }

  static async completeMaintenance(resourceId: string) {
    const resource = await Resource.findById(resourceId);
    if (!resource) throw new Error('Resource not found');

    resource.usageCount = 0;
    resource.usageDurationHours = 0;
    resource.status = 'available';
    await resource.save();

    // Mark related maintenance tasks as completed
    await Task.updateMany(
      { resourceId: resource._id, status: 'open' },
      { $set: { status: 'completed' } }
    );

    return resource;
  }
}
