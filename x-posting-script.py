# 🐍 Python Script for X (Twitter) Posting
# Requires: pip install tweepy

import tweepy

# Replace with your actual tokens after OAuth flow
API_KEY = "VIZhcLmDfNlQCqeemikRxbylY"
API_SECRET = "WUXQuGJI2eB88or0r1ajgC6iAJ54cztFbvNKLrj3HkIIYmBbdT"
ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE"  # Get from OAuth flow
ACCESS_TOKEN_SECRET = "YOUR_ACCESS_TOKEN_SECRET_HERE"  # Get from OAuth flow

def post_update_1():
    """Post Update 1 to X/Twitter"""

    # Initialize Tweepy client
    client = tweepy.Client(
        consumer_key=API_KEY,
        consumer_secret=API_SECRET,
        access_token=ACCESS_TOKEN,
        access_token_secret=ACCESS_TOKEN_SECRET
    )

    # Update 1 content
    tweet_text = """I'm building for the @lablab_ai AMD Developer Hackathon to solve a R1.5T problem: "Consensus on Garbage" in South African property collateral. 🇿🇦

Most deed verification is reactive. ProofBridge Liner is a proactive Safety Kernel that intercepts fraud before registration using Bayesian Stratified Proving.

Currently deploying our v1.1.1 hardened core to AMD Instinct MI300X GPUs to hit sub-1ms latency for JS2 compliance.

Check the progress here: 🛡️ https://huggingface.co/spaces/lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel

#AMD #ROCm #FinTechSA #PropTech #AMDDeveloperHackathon @AIatAMD"""

    try:
        # Post the tweet
        response = client.create_tweet(text=tweet_text)
        print(f"✅ Tweet posted successfully! Tweet ID: {response.data['id']}")
        return response.data['id']
    except Exception as e:
        print(f"❌ Error posting tweet: {e}")
        return None

def post_update_2():
    """Post Update 2 to X/Twitter"""

    client = tweepy.Client(
        consumer_key=API_KEY,
        consumer_secret=API_SECRET,
        access_token=ACCESS_TOKEN,
        access_token_secret=ACCESS_TOKEN_SECRET
    )

    tweet_text = """Performance is a security feature. ⚡

Integrating AMD ROCm 7 with our Bayesian Safety Kernel to handle 500 transactions/sec at <1ms latency. In a high-stakes banking environment, security cannot be a bottleneck.

We are using TEE (Trusted Execution Environments) on the #MI300X to ensure our risk scores are cryptographically bound to hardware. No bypass. No tampering. Just hardware-locked trust.

Live on @HuggingFace: https://huggingface.co/spaces/lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel

#ROCm #ConfidentialComputing #AI #AMD @lablab_ai @AIatAMD"""

    try:
        response = client.create_tweet(text=tweet_text)
        print(f"✅ Update 2 posted successfully! Tweet ID: {response.data['id']}")
        return response.data['id']
    except Exception as e:
        print(f"❌ Error posting Update 2: {e}")
        return None

if __name__ == "__main__":
    print("🚀 ProofBridge Liner X Posting Script")
    print("=" * 50)

    # Post Update 1
    print("\n📈 Posting Update 1...")
    tweet_id_1 = post_update_1()

    # Optional: Post Update 2
    if tweet_id_1:
        import time
        print("\n⏳ Waiting 5 seconds before Update 2...")
        time.sleep(5)

        print("\n⚡ Posting Update 2...")
        tweet_id_2 = post_update_2()

    print("\n✨ Posting complete! Check your X/Twitter account.")