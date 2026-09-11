from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.models import User
from app.core.security import get_password_hash

DEMO_PROFILES = [
    {
      'username': 'supervisor01',
      'email': 'supervisor@nciipc.gov.in',
      'registered_email': 'aegis.supervisor123@gmail.com',  # real authorized inbox
      'password': 'Admin@2026',
      'role': 'SUPERVISOR',
      'organization': 'NCIIPC',
      'avatar_color': '#16a34a'
    },
    {
      'username': 'auditor01',
      'email': 'auditor@cert-in.gov.in',
      'registered_email': 'aegis.supervisor123@gmail.com',
      'password': 'Audit@2026',
      'role': 'AUDITOR',
      'organization': 'CERT-In',
      'avatar_color': '#2563eb'
    },
    {
      'username': 'analyst01',
      'email': 'analyst@powergrid.in',
      'registered_email': 'aegis.supervisor123@gmail.com',
      'password': 'Analyst@2026',
      'role': 'ANALYST',
      'organization': 'National Energy Systems',
      'avatar_color': '#d97706'
    },
    {
      'username': 'admin01',
      'email': 'admin@aegis.gov.in',
      'registered_email': 'aegis.supervisor123@gmail.com',
      'password': 'Admin@2026',
      'role': 'ADMINISTRATOR',
      'organization': 'A.E.G.I.S. Command',
      'avatar_color': '#6366f1'
    }
]

def seed_users():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for profile in DEMO_PROFILES:
            user = db.query(User).filter(User.email == profile['email']).first()
            if not user:
                print(f"Creating user {profile['email']}...")
                new_user = User(
                    username=profile['username'],
                    email=profile['email'],
                    registered_email=profile['registered_email'],
                    hashed_password=get_password_hash(profile['password']),
                    role=profile['role'],
                    organization=profile['organization'],
                    avatar_color=profile['avatar_color']
                )
                db.add(new_user)
            else:
                print(f"Updating user {profile['email']}...")
                user.username = profile['username']
                user.registered_email = profile['registered_email']
                user.hashed_password = get_password_hash(profile['password'])
                user.role = profile['role']
                user.organization = profile['organization']
                user.avatar_color = profile['avatar_color']
        db.commit()
        print("Users seeded successfully!")
    except Exception as e:
        print(f"Error seeding users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
