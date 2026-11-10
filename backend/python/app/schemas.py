from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: str
    password: str
    is_at_least_16: Annotated[bool, Field(alias="isAtLeast16")] = False


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str
    new_password: Annotated[str, Field(alias="newPassword")]


class DeleteUserRequest(BaseModel):
    password: str


class ProfileBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = None
    user_name: Annotated[str | None, Field(alias="userName")] = None
    alias: str | None = None
    email: str
    phone: str | None = None
    biography: str | None = None
    coordinates: list[float] | None = None
    address: str | None = None
    avatar_url: Annotated[str | None, Field(alias="avatarUrl")] = None

    @field_validator("coordinates")
    @classmethod
    def normalize_coordinates(cls, value: list[float] | None) -> list[float] | None:
        if value is None or len(value) < 2:
            return None
        return [float(value[0]), float(value[1])]


class EventBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = None
    title: str = ""
    description: str = ""
    date: str = ""
    time: str = ""
    location: str = ""
    address: str = ""
    coordinates: list[float]
    category: str = ""
    image: str | None = None
    images: list[str] | None = None
    organizer_id: Annotated[str | None, Field(alias="organizerId")] = None
    organizer_name: Annotated[str | None, Field(alias="organizerName")] = None
    organizer_avatar: Annotated[str | None, Field(alias="organizerAvatar")] = None
    available_spots: Annotated[int | None, Field(alias="availableSpots")] = None
    total_spots: Annotated[int | None, Field(alias="totalSpots")] = None
    am_i_member: Annotated[bool, Field(alias="amIMember")] = False

    @field_validator("coordinates")
    @classmethod
    def normalize_coordinates(cls, value: list[float]) -> list[float]:
        if value is None or len(value) < 2:
            raise ValueError("coordinates must be [latitude, longitude]")
        return [float(value[0]), float(value[1])]


class ReviewBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = None
    user_id: Annotated[str | None, Field(alias="userId")] = None
    event_id: Annotated[str, Field(alias="eventId")]
    user_name: Annotated[str | None, Field(alias="userName")] = None
    user_avatar: Annotated[str | None, Field(alias="userAvatar")] = None
    rating: int
    comment: str = ""
    date: str | None = None
