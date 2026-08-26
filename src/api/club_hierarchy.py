from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/api/clubs", tags=["Club Hierarchy"])

class RoleNodeUpdate(BaseModel):
    role_id: int
    reports_to_role_id: Optional[int] = None

class OrgChartTreeUpdate(BaseModel):
    nodes: List[RoleNodeUpdate]

def build_role_tree(roles: List[Any], parent_id: Optional[int] = None) -> List[Dict[str, Any]]:
    tree = []
    for role in roles:
        if role.reports_to_role_id == parent_id:
            children = build_role_tree(roles, parent_id=role.id)
            tree.append({
                "id": role.id,
                "title": role.title,
                "user": {
                    "name": role.user.full_name if role.user else "Vacant",
                    "email": role.user.email if role.user else None,
                    "photo_url": role.user.photo_url if role.user else None,
                },
                "reports_to_role_id": role.reports_to_role_id,
                "children": children
            })
    return tree

@router.get("/{club_id}/org-chart")
def get_club_org_chart(club_id: int, db: Session = Depends(get_db)):
    roles = db.query(ClubRole).filter(ClubRole.club_id == club_id).all()
    if not roles:
        raise HTTPException(status_code=404, detail="Club roles not found")
    
    hierarchical_tree = build_role_tree(roles, parent_id=None)
    return {"club_id": club_id, "org_chart": hierarchical_tree}

@router.put("/{club_id}/org-chart")
def update_club_org_chart(club_id: int, payload: OrgChartTreeUpdate, db: Session = Depends(get_db)):
    for node_update in payload.nodes:
        role = db.query(ClubRole).filter(ClubRole.id == node_update.role_id, ClubRole.club_id == club_id).first()
        if role:
            role.reports_to_role_id = node_update.reports_to_role_id
    db.commit()
    return {"status": "success", "message": "Org chart hierarchy updated successfully."}
