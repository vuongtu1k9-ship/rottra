import sys
import argparse
from diffusers import AutoPipelineForText2Image
import torch

def generate_image(prompt, output_path):
    print(f"Loading local offline model for prompt: {prompt}")
    try:
        # Using a fast turbo model for offline generation
        pipeline = AutoPipelineForText2Image.from_pretrained(
            "stabilityai/sdxl-turbo", torch_dtype=torch.float32 # Use float32 for wider compatibility if no GPU
        )
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cuda":
            pipeline.to(device, torch.float16) # Optimization for GPU
        
        print(f"Using device: {device}. Generating image...")
        # Generate photorealistic image
        image = pipeline(prompt=prompt, num_inference_steps=4, guidance_scale=0.0).images[0]
        
        image.save(output_path)
        print(f"SUCCESS: Saved generated image to {output_path}")
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", type=str, required=True)
    parser.add_argument("--output", type=str, required=True)
    args = parser.parse_args()
    
    generate_image(args.prompt, args.output)
