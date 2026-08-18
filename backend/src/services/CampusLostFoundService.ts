import { Router, Request, Response } from 'express';

export interface LostFoundDTO {
  id: string;
  itemTitle: string;
  itemCategory: string;
  reportType: 'LOST' | 'FOUND';
  location: string;
  rewardAmountUSD: number;
  finderName: string;
  isClaimed: boolean;
}

export class CampusLostFoundService {
  private items: LostFoundDTO[] = [
    {
      id: 'item-801',
      itemTitle: 'Apple AirPods Pro Gen 2',
      itemCategory: 'Electronics',
      reportType: 'LOST',
      location: 'Engineering Library',
      rewardAmountUSD: 40,
      finderName: 'Elena Rostova',
      isClaimed: false,
    },
    {
      id: 'item-802',
      itemTitle: 'Hydro Flask 32oz Water Bottle',
      itemCategory: 'Personal Belongings',
      reportType: 'FOUND',
      location: 'Student Union',
      rewardAmountUSD: 0,
      finderName: 'Marcus Vance',
      isClaimed: false,
    },
  ];

  public getItems(category?: string): LostFoundDTO[] {
    if (!category || category === 'All') return this.items;
    return this.items.filter(i => i.itemCategory === category);
  }

  public claimItem(id: string): LostFoundDTO | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    item.isClaimed = true;
    return item;
  }
}

const lostFoundService = new CampusLostFoundService();
const lostFoundRouter = Router();

lostFoundRouter.get('/lostfound/items', (req: Request, res: Response) => {
  const { category } = req.query;
  const items = lostFoundService.getItems(category as string);
  res.json({ success: true, data: items });
});

lostFoundRouter.post('/lostfound/items/:id/claim', (req: Request, res: Response) => {
  const updated = lostFoundService.claimItem(req.params.id);
  if (!updated) return res.status(404).json({ success: false, error: 'Item record not found' });
  res.json({ success: true, data: updated });
});

export default lostFoundRouter;
