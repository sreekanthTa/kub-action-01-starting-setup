import random
import sys

def generate_random():
    random_num = random.randint(1,10)

    return random_num


num = generate_random()
print(num)

if num %2 == 0:
     print("Exiting", num)
     sys.exit(1)
else:
     print("Success", num)
     sys.exit(0)