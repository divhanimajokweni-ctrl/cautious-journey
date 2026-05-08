# 🚀 Deploy to Hugging Face Space
**Space:** lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel

## 📋 **Deployment Commands** (Run on your local machine)

### **1. Update the README.md**
```bash
# Copy the optimized README to your space directory
cp huggingface-space-README.md /path/to/your/space/README.md
```

### **2. Upload to Hugging Face**
```bash
# Upload all changes to the space
hf upload lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel \
  --repo-type space \
  --commit-message "feat: deploy social strategy + performance metrics for AMD hackathon"
```

### **3. Set Hardware (if needed)**
```bash
# Ensure MI300X hardware is set
hf spaces hardware-set lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel --hardware "amd-instinct-mi300x"
```

### **4. Monitor Deployment**
```bash
# Check deployment status
hf spaces logs lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel --build
```

## 📦 **Files to Deploy**

- ✅ `README.md` - Optimized for hackathon with performance metrics
- ✅ Performance graph content
- ✅ Social strategy links
- ✅ Community engagement section

## 🔗 **Space URL**
**Live Space:** https://huggingface.co/spaces/lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel

## 📊 **Post-Deployment Checklist**

- [ ] Space loads with updated README
- [ ] Performance graph displays correctly
- [ ] Social media links work
- [ ] Hardware shows as AMD Instinct MI300X
- [ ] Community can access and like the space

## 🎯 **Hackathon Impact**

This deployment includes:
- **Build in Public content** for prize eligibility
- **Performance benchmarks** proving MI300X capability
- **Community engagement hooks** for likes/shares
- **Technical credibility** with compliance details

**Run these commands on your local machine where you have the hf CLI installed!** 🚀

Let me know when the deployment is complete and I'll help with the next phase.