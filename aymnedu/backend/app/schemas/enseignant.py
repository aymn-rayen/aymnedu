from pydantic import BaseModel, ConfigDict, EmailStr


class EnseignantCreate(BaseModel):
    full_name: str
    email: str
    password: str


class EnseignantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    is_active: bool
