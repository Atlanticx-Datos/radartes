#!/bin/bash

# This script generates example placeholder images for all category-discipline pairs
# You should replace these with actual images later

# Define all disciplines
DISCIPLINES=("visuales" "musica" "escenicas" "literatura" "diseno" "cine" "otras")

# Define all categories
CATEGORIES=("beca" "residencia" "premio" "concurso" "convocatoria" "oportunidad" "fondos" "apoyo")

# Create placeholder images for disciplines (fallbacks)
echo "Creating discipline placeholder images..."
for discipline in "${DISCIPLINES[@]}"; do
  touch "$discipline.jpg"
  echo "Created $discipline.jpg"
done

# Create a placeholder image
echo "Creating placeholder fallback image..."
touch "placeholder.jpg"
echo "Created placeholder.jpg"

# Create the pairs directory if it doesn't exist
mkdir -p pairs

# Create all category-discipline pairs
echo "Creating all category-discipline pairs..."
for category in "${CATEGORIES[@]}"; do
  echo "Creating $category pairs..."
  for discipline in "${DISCIPLINES[@]}"; do
    touch "pairs/$category-$discipline.jpg"
    echo "Created pairs/$category-$discipline.jpg"
  done
done

echo "Done! Replace these placeholder files with actual images."
echo "See README.md for more information on image requirements and naming conventions." 