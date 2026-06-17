from datetime import datetime

from pydantic import BaseModel


class DictionaryCategoryResponse(BaseModel):
    category_id: int
    name: str
    description: str

    model_config = {"from_attributes": True}


class DictionaryVariationResponse(BaseModel):
    variation_id: str
    entry_id: str
    region: str
    video_url: str
    description: str

    model_config = {"from_attributes": True}


class DictionaryEntryResponse(BaseModel):
    entry_id: str
    category_id: int
    category_name: str
    word: str
    meaning: str
    updated_at: datetime
    variations: list[DictionaryVariationResponse] = []

    model_config = {"from_attributes": True}


class DictionarySearchResponse(BaseModel):
    entries: list[DictionaryEntryResponse]
    total: int
    keyword: str


class DictionaryVariationListResponse(BaseModel):
    entry_id: str
    variations: list[DictionaryVariationResponse]
    total: int
