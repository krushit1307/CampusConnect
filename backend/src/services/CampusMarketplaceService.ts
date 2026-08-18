import { Router, Request, Response } from 'express';

export interface ListingDTO {
  id: string;
  title: string;
  sellerName: string;
  category: string;
  condition: string;
  price: number;
  location: string;
  isSaved: boolean;
}

export class CampusMarketplaceService {
  private listings: ListingDTO[] = [
    {
      id: 'item-301',
      title: 'Apple MacBook Pro M3 Pro 16" (18GB RAM / 512GB SSD)',
      sellerName: 'Jason Reed',
      category: 'Electronics',
      condition: 'Like New',
      price: 1650,
      location: 'North Campus Dorms / Student Center',
      isSaved: false,
    },
    {
      id: 'item-302',
      title: 'Organic Chemistry (8th Edition) Hardcover + Solution Manual Set',
      sellerName: 'Maya Lin',
      category: 'Textbooks',
      condition: 'Good',
      price: 45,
      location: 'Science Library Lobby',
      isSaved: false,
    },
  ];

  public getListings(category?: string): ListingDTO[] {
    if (!category || category === 'All') return this.listings;
    return this.listings.filter(item => item.category === category);
  }

  public createListing(payload: Omit<ListingDTO, 'id' | 'isSaved'>): ListingDTO {
    const newItem: ListingDTO = {
      ...payload,
      id: `item-${Date.now()}`,
      isSaved: false,
    };
    this.listings.push(newItem);
    return newItem;
  }
}

const marketplaceService = new CampusMarketplaceService();
const marketplaceRouter = Router();

marketplaceRouter.get('/listings', (req: Request, res: Response) => {
  const { category } = req.query;
  const items = marketplaceService.getListings(category as string);
  res.json({ success: true, data: items });
});

marketplaceRouter.post('/listings', (req: Request, res: Response) => {
  const newItem = marketplaceService.createListing(req.body);
  res.json({ success: true, data: newItem });
});

export default marketplaceRouter;
