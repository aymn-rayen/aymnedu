from pydantic import BaseModel, EmailStr


class EnseignantCreate(BaseModel):
    full_name: str
    email: str
    password: str


class EnseignantOut(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool

    class Config:
        from_attributes = True
