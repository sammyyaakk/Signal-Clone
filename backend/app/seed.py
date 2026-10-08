"""Demo data so the app is usable immediately. Log in with any seeded phone and OTP 123456."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Contact, Conversation, Member, Message, Reaction, User, utcnow

SEED_USERS = [
    ("+15550000001", "Alice Johnson", "#2c6bed", "Coffee first"),
    ("+15550000002", "Bob Smith", "#cc163d", "Available"),
    ("+15550000003", "Carol Diaz", "#077d92", "At the gym"),
    ("+15550000004", "Dave Lee", "#8f2af4", "Busy"),
    ("+15550000005", "Eve Patel", "#c73800", "Reading"),
]


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)):
        return
    users = [User(phone=p, display_name=n, avatar_color=c, about=a) for p, n, c, a in SEED_USERS]
    db.add_all(users)
    db.flush()
    alice, bob, carol, dave, eve = users

    db.add_all(Contact(owner_id=a.id, contact_id=b.id) for a in users for b in users if a is not b)

    def chat(members, lines, hours_ago, name=None, admin=None, unread_for=None, unread=0):
        conversation = Conversation(
            kind="group" if name else "direct",
            name=name,
            direct_key=None if name else ":".join(str(u.id) for u in sorted(members, key=lambda u: u.id)),
            created_by=(admin or members[0]).id,
            members=[Member(user_id=u.id, role="admin" if u is admin else "member") for u in members],
        )
        db.add(conversation)
        db.flush()
        start = utcnow() - timedelta(hours=hours_ago)
        messages = [
            Message(conversation_id=conversation.id, sender_id=sender.id, body=body, created_at=start + timedelta(minutes=3 * i))
            for i, (sender, body) in enumerate(lines)
        ]
        db.add_all(messages)
        db.flush()
        conversation.last_activity_at = messages[-1].created_at
        for member in conversation.members:
            member.last_delivered_id = member.last_read_id = messages[-1].id
            if unread_for and member.user_id == unread_for.id:
                member.last_read_id = messages[-1 - unread].id
        return messages

    direct = chat([alice, bob], [
        (bob, "Hey Alice! Are we still on for lunch tomorrow?"),
        (alice, "Yes! 12:30 at the usual place?"),
        (bob, "Perfect. I'll book a table."),
        (bob, "Also, did you see the new Signal update?"),
        (bob, "The stories feature is pretty neat"),
    ], hours_ago=0.5, unread_for=alice, unread=2)
    chat([alice, carol], [
        (alice, "Can you send me the slides from today?"),
        (carol, "Sure, give me 5 minutes"),
        (carol, "Done, check your email"),
        (alice, "Got them, thanks!"),
    ], hours_ago=3)
    trip = chat([alice, bob, carol, dave], [
        (alice, "Weekend trip planning thread!"),
        (dave, "I'm in. Mountains or beach?"),
        (carol, "Mountains, definitely"),
        (bob, "Mountains + a lake would be ideal"),
        (dave, "I'll look up cabins tonight"),
    ], hours_ago=1, name="Weekend Trip", admin=alice, unread_for=alice, unread=1)
    chat([carol, alice, eve], [
        (carol, "Next book: Project Hail Mary?"),
        (eve, "Loved the author's last one, count me in"),
        (alice, "Sounds good to me"),
    ], hours_ago=26, name="Book Club", admin=carol)
    chat([bob, dave], [
        (dave, "Did you push the fix?"),
        (bob, "Yep, it's on main now"),
    ], hours_ago=5)

    db.add_all([
        Reaction(message_id=direct[2].id, user_id=alice.id, emoji="❤️"),  # "Perfect. I'll book a table."
        Reaction(message_id=trip[2].id, user_id=bob.id, emoji="👍"),  # "Mountains, definitely"
        Reaction(message_id=trip[2].id, user_id=dave.id, emoji="👍"),
        Reaction(message_id=trip[4].id, user_id=carol.id, emoji="😂"),  # "I'll look up cabins tonight"
    ])
    db.commit()
