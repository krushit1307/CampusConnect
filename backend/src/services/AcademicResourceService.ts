import { Router, Request, Response } from 'express';

export interface ResourceDTO {
  id: string;
  title: string;
  courseCode: string;
  department: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  verified: boolean;
  downloadsCount: number;
}

export class AcademicResourceService {
  private resources: ResourceDTO[] = [
    {
      id: 'res-101',
      title: 'Advanced Data Structures & Algorithms Comprehensive Study Pack',
      courseCode: 'CS301',
      department: 'Computer Science',
      fileUrl: '/storage/academic/cs301_study_pack.pdf',
      fileSize: 14889728,
      uploadedBy: 'usr-prof-elena',
      verified: true,
      downloadsCount: 1420,
    },
    {
      id: 'res-102',
      title: 'Quantum Mechanics & Field Theory Past Midterm & Final Exams',
      courseCode: 'PHYS402',
      department: 'Physics',
      fileUrl: '/storage/academic/phys402_exams.zip',
      fileSize: 9122611,
      uploadedBy: 'usr-prof-marcus',
      verified: true,
      downloadsCount: 890,
    },
  ];

  public getAllResources(department?: string, courseCode?: string): ResourceDTO[] {
    return this.resources.filter((res) => {
      if (department && res.department !== department) return false;
      if (courseCode && res.courseCode !== courseCode) return false;
      return true;
    });
  }

  public getResourceById(id: string): ResourceDTO | undefined {
    return this.resources.find((res) => res.id === id);
  }

  public incrementDownloadCounter(id: string): ResourceDTO | null {
    const resource = this.getResourceById(id);
    if (!resource) return null;
    resource.downloadsCount += 1;
    return resource;
  }

  public createResource(payload: Omit<ResourceDTO, 'id' | 'downloadsCount'>): ResourceDTO {
    const newResource: ResourceDTO = {
      ...payload,
      id: `res-${Date.now()}`,
      downloadsCount: 0,
    };
    this.resources.push(newResource);
    return newResource;
  }
}

const resourceService = new AcademicResourceService();
const academicRouter = Router();

academicRouter.get('/resources', (req: Request, res: Response) => {
  const { department, courseCode } = req.query;
  const items = resourceService.getAllResources(department as string, courseCode as string);
  res.json({ success: true, data: items });
});

academicRouter.post('/resources/:id/download', (req: Request, res: Response) => {
  const updated = resourceService.incrementDownloadCounter(req.params.id);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Resource not found' });
  }
  res.json({ success: true, downloadsCount: updated.downloadsCount });
});

export default academicRouter;
