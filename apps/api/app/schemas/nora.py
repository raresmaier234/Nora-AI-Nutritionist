"""Request and response shapes for Nora, the in-app assistant (`/api/v1/nora`)."""

from datetime import date as Date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Long enough for a real question; a cap on what one message can cost.
MAX_MESSAGE_CHARS = 2000
# Nora's own earlier replies, sent back as the conversation: longer than a question can be.
MAX_REPLY_CHARS = 8000
# The conversation the app keeps and resends; older turns drop off the front.
MAX_MESSAGES = 30


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(
        min_length=1,
        max_length=MAX_REPLY_CHARS,
        description=f"At most {MAX_MESSAGE_CHARS} characters from the user, {MAX_REPLY_CHARS} from Nora.",
    )

    @model_validator(mode="after")
    def _user_messages_are_short(self) -> "ChatMessage":
        if self.role == "user" and len(self.content) > MAX_MESSAGE_CHARS:
            raise ValueError(f"a message can be at most {MAX_MESSAGE_CHARS} characters")
        return self


class ChatRequest(BaseModel):
    """The conversation so far, oldest first, ending with the user's new message."""

    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    date: Date | None = Field(
        default=None,
        description="The user's local date, for 'today' in Nora's context. Defaults to the "
        "server's date.",
    )


class ChatReply(BaseModel):
    reply: str = Field(description="Nora's answer, plain text with short lists at most.")
