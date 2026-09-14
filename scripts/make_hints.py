#!/usr/bin/env python3
"""
One-shot authoring helper: reads riddles-categorized.json and writes
data/hints.json  ( { "exact question text": "hint", ... } ).

Run once (or re-run when a hint needs tweaking).  Then run
scripts/merge_hints.py to fold the hints back into the JSON.

Quality bar:
  * one line, <= ~12 words
  * never contains the answer word (case-insensitive substring check)
  * age-appropriate to its group
"""
import json, sys, re

SRC = "data/riddles-categorized.json"
OUT = "data/hints.json"

# ── under-10 hints (205) ──────────────────────────────────────────────
U10 = [
 "Something people ask for and give, but rarely take",                          # 0  advice
 "A number that only ever increases with you",                                  # 1  age
 "Invisible, but you need it every second to live",                             # 2  air
 "You can't see it, but holding it in kills you",                               # 3  air
 "A heavy weight ships drop to hold their place",                               # 4  anchor
 "You toss it overboard to keep a ship from drifting",                          # 5  anchor
 "Red outside, white inside, with a seed in the middle",                        # 6  apple
 "Round, bouncy, and a favorite at recess",                                     # 7  ball
 "Yellow when ripe; peel back the skin to eat",                                 # 8  bananas
 "A flying mammal that hangs upside down",                                      # 9  bat
 "A flying animal that helps you find your way at night",                       #10  bat
 "Sandy shore where the sea meets the land",                                    #11  beach
 "Furniture where you rest your head at night",                                 #12  bed
 "Four legs, one head, and a place to rest",                                    #13  bed
 "A home where insects store their sweet golden treasure",                      #14  beehive
 "Round, with a clapper inside that rings out",                                 #15  bell
 "A metal thing with a hard tongue that speaks",                                #16  bell
 "A bag you squeeze to blow air onto a fire",                                   #17  bellows
 "A day that comes once every year; you get one less each year",                #18  birthday
 "A color you find in the sky, sea, and a bird",                                #19  blue
 "Pages, a spine, and a story to tell",                                         #20  book
 "Objects that open up to show you their inside",                               #21  books
 "A nickname for someone who reads a lot",                                      #22  bookworm
 "Worn in pairs on your feet; filled all day, empty at rest",                   #23  boots
 "Has a neck, body, and bottom; holds liquid",                                  #24  bottle
 "You do it automatically and can't hold it long",                              #25  breath
 "You can see it when the weather is cold",                                     #26  breath
 "Given at birth; holding it in will stop you",                                 #27  breath
 "You do it thousands of times a day without thinking",                         #28  breath
 "Crosses water without touching it",                                           #29  bridge
 "A cleaning tool that dances around the house",                                #30  broom
 "Many bristle 'legs' and a long handle, yet cannot stand",                     #31  broom
 "A large horned male cow in a pen",                                            #32  bull
 "Travels through a dark tube; fires when pulled back",                        #33  bullet
 "Round, flat, with two holes that let thread through",                        #34  button
 "You flip a new page of it each month",                                        #35  calendar
 "One lens ('eye') that captures the moments you treasure",                    #36  camera
 "Wax that melts as it burns; wind is its enemy",                              #37  candle
 "Lives in hours, devoured by flame, thinned by use",                          #38  candle
 "A set with thirteen of each suit",                                            #39  cards
 "A soft pet that always stays on the floor",                                   #40  carpet
 "A stone fortress with towers, a moat, and a gate",                           #41  castle
 "A pet that purrs, hisses, and chases mice",                                   #42  cat
 "A pet with whiskers, four paws, and a wagging tail",                         #43  cat
 "Linked metal rings, strong as steel",                                         #44  chain
 "Furniture with legs, a back, and arms to sit on",                            #45  chair
 "Used for grilling; turns from black to red to white",                        #46  charcoal
 "Aged dairy product, often yellow and sharp",                                  #47  cheese
 "A red fruit with a stem and a pit",                                           #48  cherry
 "Tells time; has hands and a face",                                            #49  clock
 "Has hands but no arms; a face but no head",                                   #50  clock
 "White and fluffy in the sky; brings rain",                                    #51  cloud
 "Black rock that burns and turns white when done",                             #52  coal
 "Black, red when lit, white when spent",                                       #53  coal
 "Tropical nut with a hard brown shell and white flesh",                        #54  coconut
 "Round money with a head and a tail",                                          #55  coin
 "You catch it but can't throw it back",                                        #56  cold
 "Many teeth that never bite; used to tidy hair",                               #57  comb
 "A simple device whose needle always points north",                            #58  compass
 "You eat the outside kernels, discard the inside cob",                         #59  corn
 "The more of it there is, the less you can see",                               #60  darkness
 "Cut and dealt at a card table, but never eaten",                              #61  deck
 "Fills cavities; everyone needs them but many fear them",                      #62  dentist
 "A four-legged work surface you sit at for hours",                             #63  desk
 "Tiny glass beads on the grass in the morning",                                #64  dew
 "A cube with numbers on each of its six faces",                                #65  die
 "Wears a coat in winter, 'pants' in summer",                                   #66  dog
 "A toy with hands, teeth, and feet that can't move",                           #67  doll
 "Looks human but can't think, eat, or fear",                                   #68  doll
 "A ring-shaped pastry with a hole in the middle",                              #69  doughnut
 "You hit the skin to make a loud rhythm",                                      #70  drum
 "Tiny particles that settle on everything",                                    #71  dust
 "Our planet, third from the sun",                                              #72  earth
 "A sound that repeats itself, then dies",                                      #73  echo
 "A shell you crack to get to the golden inside",                               #74  egg
 "A box without hinges; a golden treasure inside",                              #75  egg
 "Break it before you can cook or eat it",                                      #76  egg
 "Flows through wires, powers everything, but can shock you",                   #77  electricity
 "The largest land animal, with a long trunk",                                  #78  elephant
 "A pair that travels to distant places",                                       #79  eyes
 "An emotion that makes your hands sweat and heart race",                       #80  fear
 "Light and soft; once used to write with",                                     #81  feather
 "A part of your hand with a nail at the end",                                  #82  finger
 "Feed it and it lives; water kills it",                                        #83  fire
 "Grows with wood, dies with water",                                            #84  fire
 "Always hungry; licks and burns what it touches",                              #85  fire
 "Licks your finger and turns it red",                                          #86  fire
 "Shoots up and bursts into colorful bursts of light",                         #87  firework
 "Tiny bugs that make you itch when they escape",                               #88  fleas
 "A plant with a stem and colorful petals",                                     #89  flower
 "An insect that buzzes around food and windows",                               #90  fly
 "A mark left by a foot; can expose a thief",                                   #91  footstep
 "Water that bubbles, laughs, and splashes in your face",                       #92  fountain
 "A cold coating that covers the ground in winter",                             #93  frost
 "Made by melting sand; fragile and transparent",                               #94  glass
 "Two lenses that help you see without riding a horse",                        #95  glasses
 "Cover your hands; have fingers and thumbs of their own",                      #96  gloves
 "You put them on your empty hands",                                            #97  gloves
 "Two skins, one outside and one inside; point the way",                        #98  gloves
 "Small round fruit, crushed to make a drink",                                  #99  grapes
 "Green blades that cover the ground and cut the wind",                        #100  grass
 "A word that still contains 'bit' after removing letters",                    #101  habit
 "Unruly on your head; you trim it with scissors",                             #102  hair
 "Grows on your head, under your hat",                                          #103  hair
 "How far into the forest can it go?",                                                    #104  halfway
 "You wave, drum, and use them everywhere",                                     #105  hands
 "Used to hoe, slay, and wring tears",                                          #106  hands
 "In an emergency, this is the first thing to make",                           #107  haste
 "Dried grass that animals eat and absorbs spills",                             #108  hay
 "A red muscle that beats without being touched",                               #109  heart
 "A red drum in your chest that stops when you do",                            #110  heart
 "Break it and it stops; lose it and nothing matters",                         #111  heart
 "An empty space that makes a barrel lighter",                                  #112  hole
 "A void you dig or drill into something",                                      #113  hole
 "Grows bigger the more you take away from it",                                 #114  hole
 "The line where sky meets earth; always moves away",                           #115  horizon
 "Goes to bed at night with its metal shoes on",                                #116  horse
 "Two glass bulbs with sand running between them",                              #117  hourglass
 "Mostly hidden below the waterline",                                           #118  iceberg
 "Icy spikes that hang from a roof, pointing down",                            #119  icicle
 "A metal heated red in water, quenched black",                                #120  iron
 "Something you crack, make, tell, and play",                                   #121  joke
 "Turns to let things in and out",                                              #122  key
 "Opens what force and strength cannot",                                        #123  key
 "A small opening in a door it never enters",                                   #124  keyhole
 "Bliss to two; men lie for it",                                               #125  kiss
 "A toy that dances in the wind on a string",                                  #126  kite
 "A portable light with a glass body and iron roof",                           #127  lantern
 "Molten rock that flows from the earth",                                      #128  lava
 "Green parts of trees that fall in autumn",                                    #129  leaves
 "Crunch when you walk on the dead ones",                                       #130  leaves
 "A limb you run, jump, swim, and stretch with",                               #131  leg
 "A building full of stories (books)",                                         #132  library
 "Something untrue that can break a heart",                                     #133  lie
 "Fills a room without taking up any space",                                    #134  light
 "A crustacean that's black alive and red cooked",                             #135  lobster
 "A mechanism a dagger turns to open and close",                               #136  lock
 "A piece of wood that crackles in a fire",                                     #137  log
 "Shows rivers, forests, and cities on paper",                                  #138  map
 "Covers your face; used for disguise or parties",                              #139  mask
 "A stick that lights with a scratch",                                          #140  match
 "Turns into cream when churned",                                              #141  milk
 "Shows your reflection; right becomes left",                                   #142  mirror
 "Smile at it and it smiles right back",                                        #143  mirror
 "Everyone sees themselves in it; scratching ruins it",                        #144  mirror
 "Reflects everything you put in front of it",                                  #145  mirror
 "Thick fog you can't scoop into a bowl",                                       #146  mist
 "Goes further the slower (cheaper) it is",                                     #147  money
 "Sounds that make you dance, laugh, or cry",                                   #148  music
 "Someone who plays instruments for a living",                                  #149  musician
 "A pin with a head, partly hidden in wood",                                    #150  nail
 "Given to you, used more by your friends",                                     #151  name
 "A pointed metal pin with a thread-eye",                                       #152  needle
 "Has an eye but cannot see",                                                   #153  needle
 "Long and thin, used for sewing in the light",                                 #154  needle
 "A bird's home high in a tree with eggs inside",                               #155  nest
 "A mesh with a handle for catching things",                                    #156  net
 "Information that can be broken or spread",                                    #157  news
 "A sound you can block out with a finger",                                     #158  noise
 "Runs a cold; sits between your eyes",                                         #159  nose
 "Two little holes in a pink-red bump",                                         #160  nose
 "A small round food with a hard shell",                                        #161  nut
 "Makes you cry when you peel it",                                              #162  onion
 "Layers you slice off; you weep beside it",                                    #163  onion
 "A citrus fruit that cures scurvy",                                            #164  orange
 "A bird that hoots at night and never answers",                                #165  owl
 "You write on it; holds most knowledge ever said",                             #166  paper
 "A bird with a colorful fan of feathers behind it",                           #167  peacock
 "A legume with two or three inside a shell",                                   #168  peanut
 "A round gem made inside a shell, shining pale",                               #169  pearl
 "Writes with ink; runs dry with too much use",                                 #170  pen
 "Yellow with a dark tip; leaves erasable marks",                               #171  pencil
 "A copper coin with a head and tail",                                          #172  penny
 "Loses its shape in the morning, regains it at night",                         #173  pillow
 "Pops into a bigger, lighter version with a loud noise",                      #174  popcorn
 "Has 'eyes' and a skin; great when baked or fried",                           #175  potato
 "Officiates weddings but is never a bride or groom",                          #176  priest
 "A play on words; the worse it is, the better",                                #177  pun
 "The dark center of the eye that changes size",                                #178  pupil
 "Two parallel steel rails with thousands of cross-ties",                      #179  railroad
 "A vinyl disc you drop the needle on",                                         #180  record
 "Your image in a mirror or still water",                                       #181  reflection
 "You see it but can never touch it",                                           #182  reflection
 "A slip of the tongue; heard but not seen",                                    #183  remark
 "Flows but doesn't walk; has a bed and a mouth",                               #184  river
 "A path through hills, forests, and over rivers",                              #185  road
 "Coiled strands of twisted fiber, strong yet unravels",                       #186  rope
 "Strong as ten men but a boy can walk it off",                                #187  rope
 "An open shoe with straps that bind the foot",                                 #188  sandal
 "A blade with sharp teeth for cutting",                                        #189  saw
 "Something you share and it's no longer yours",                                #190  secret
 "Worn on the upper body; has a collar and sleeves",                            #191  shirt
 "Covers your foot; the 'tongue' is inside",                                    #192  shoe
 "Rests under the bed at night with a tongue sticking out",                    #193  shoe
 "Lies under the bed with its 'tongue' hanging out",                           #194  shoe
 "Worn in pairs, wear thin the more you go",                                    #195  shoes
 "Slow animal with a shell on its back",                                        #196  snail
 "Carries its house on its back, runs without legs",                           #197  snail
 "Used for washing, shrinks the more it works",                                 #198  soap
 "Two rows that chew and keep your mouth working",                              #199  teeth
 "Thirty white ones on a red hill (gums)",                                      #200  teeth
 "Something you say to show gratitude",                                         #201  thanks
 "The short finger on your hand, used for gestures",                           #202  thumb
 "Tall plants that give shade and clean the air",                               #203  trees
 "Water that cascades over a cliff, bright and loud",                          #204  waterfall
]

# ── over-10 hints (172) ────────────────────────────────────────────────
O10 = [
 "A drink that eases pain but causes trouble",                                  # 0  alcohol
 "A feathered projectile shot from a bow",                                      # 1  arrow
 "Has a head and feathers, but is not alive",                                    # 2  arrow
 "A word puzzle using letters from blood, acorn, sorrow, refrain",              # 3  barrel
 "A stinging insect that guards honey",                                          # 4  bee
 "A game with 32 pieces on 64 squares",                                          # 5  chess
 "Making a decision gives you two options or none",                             # 6  choice
 "Made by one, bought by one, used by another who doesn't want it",             # 7  coffin
 "The maker sells it; the buyer never uses it",                                 # 8  coffin
 "Fake money: made secretly, used unknowingly",                                 # 9  counterfeit
 "A biblical king; a letter puzzle with 5s",                                    #10  david
 "The inevitable end that comes for everyone",                                  #11  death
 "The ending of all that begins",                                               #12  death
 "A white bird, sign of peace; a word puzzle",                                  #13  dove
 "Six letters; remove one and twelve remains",                                  #14  dozens
 "You experience it while sleeping, turning and tossing",                       #15  dream
 "A word starting and ending with E, containing one letter",                    #16  envelope
 "A hole in a white (sclera)",                                                  #17  eye
 "Pronounced like 'I', spelled with three letters",                             #18  eye
 "Your destiny; written but not felt",                                          #19  fate
 "A three-letter word; add two letters and there will be less of it",    #20  few
 "Lives in water, covered in scales, never thirsty",                            #21  fish
 "Waves in the wind on a pole; saluted by armies",                             #22  flag
 "Flutters on a pole, says nothing",                                            #23  flag
 "A four-legged amphibian that croaks at night",                                #24  frog
 "A word puzzle: a food you and I both eat",                                     #25  fruit
 "A word puzzle: an animal hide used in life and death",                        #26  fur
 "A precious metal, easily beaten into sheets",                                 #27  gold
 "A cold, dark resting place that never complains",                             #28  grave
 "The force that pulls everything to the center",                               #29  gravity
 "A resentment you carry against someone else",                                 #30  grudge
 "Two in a whole, four in a pair, six in a trio",                               #31  half
 "Clear, walkable on water, melts in the sun",                                  #32  ice
 "Crushes ships and roofs, yet fears the sun",                                  #33  ice
 "A word with 'kst' in the middle, beginning, and end",                         #34  inkstand
 "Balance, scales, and fairness; cuts through evil",                            #35  justice
 "A feeling that touches once and lasts a lifetime",                            #36  love
 "Brings back the past; makes you cry, laugh, and feel young",                 #37  memory
 "A god, a planet, and a measure of temperature",                               #38  mercury
 "Unreal but feels real; lives in the head",                                    #39  mind
 "Changes phases: new, full, and sometimes blue",                               #40  moon
 "The bright circle in the night sky",                                          #41  moon
 "White and round, sometimes visible, sometimes not",                           #42  moon
 "Always the same yet always different (phases)",                               #43  moon
 "Pregnant every night (waxing) but never gives birth",                        #44  moon
 "A scythe shape in the dark sky, guiding travelers",                          #45  moon
 "Tall with roots deep underground, never grows taller",                        #46  mountain
 "A fungus that grows in the forest; a 'room' with no doors",                  #47  mushroom
 "A word that's the same forwards, backwards, and upside down",                #48  noon
 "The poor have it, the rich need it, eating it kills",                        #49  nothing
 "Loved more than life, feared more than death",                                #50  nothing
 "You are buying digits, not objects",                                        #51  numbers
 "A liquid that fuels engines and builds wealth",                               #52  oil
 "What lies behind you, with sounds and sights",                                #53  past
 "Chess pieces that protect the king",                                          #54  pawns
 "Three letters; remove two and it still sounds the same",                     #55  pea
 "88 keys without locks that unlock your soul",                                 #56  piano
 "A word puzzle: an animal, best when roasted",                                 #57  pig
 "An emotion that can swallow you whole",                                       #58  pride
 "Heir to a throne; power falls when the king dies",                           #59  prince
 "An arc of colors after rain; a bow no one can bend",                         #60  rainbow
 "A puzzle you solve with your wits",                                           #61  riddle
 "A question that needs a clever, non-physical key",                           #62  riddle
 "A circle that can hold flesh, bones, and blood",                              #63  ring
 "Salty, stings the eyes, used in cooking",                                     #64  salt
 "Builds castles, erodes mountains, blinds and helps",                          #65  sand
 "Falls from the sky; the world is made of it",                                 #66  sand
 "Measures time; eventually everything crumbles to it",                        #67  sand
 "Two blades that open wide and shut tight",                                    #68  scissors
 "Cast by an object in light; vanishes without light",                         #69  shadow
 "Follows you all day, nearly vanishes at noon",                                #70  shadow
 "Crawls on the ground, rises on walls",                                        #71  shadow
 "One color (black), many sizes; present in sun, not rain",                    #72  shadow
 "Tall in the morning, short at noon, gone at night",                          #73  shadow
 "Dividing something in two, one for each",                                     #74  sharing
 "A large boat with a cargo hold and masts",                                    #75  ship
 "The dead carrying the living (a funeral at sea)",                             #76  ship
 "A five-letter word that literally shrinks when you add two letters",      #77  short
 "A round container with holes that can't be filled",                          #78  sieve
 "Saying its name breaks it",                                                   #79  silence
 "A word puzzle: a fine natural fabric",                                        #80  silk
 "The drowned man was her brother, not his",                                    #81  sister
 "Double is less than a score; half is less than four",                        #82  six
 "The framework of bones inside the body",                                      #83  skeleton
 "Bones joined together to form the body",                                      #84  skeleton
 "The outer layer of the body; stretches and changes color",                   #85  skin
 "Rest that brings dreams; weakens but is needed",                             #86  sleep
 "A mile from end to end, freely given, seen on all",                         #87  smile
 "Fills a house and chimney, can't be scooped up",                             #88  smoke
 "Coiled, sheds its skin, has a backbone but no legs",                         #89  snake
 "White, falls from the sky, melts in your hand",                               #90  snow
 "Pure white, silent, dies on green grass",                                     #91  snow
 "White, featherless, flies from the sky",                                      #92  snow
 "A figure of snow that melts when the sun comes out",                          #93  snowman
 "Made of snow, lives with water, dies in the sun",                            #94  snowman
 "The spiritual part of a person; a genre of music",                           #95  soul
 "The vast void beyond the sky",                                                #96  space
 "Many legs, spins webs, lives in cottages and castles",                       #97  spider
 "Moves on silk threads, leaves a web behind",                                  #98  spider
 "A tiny sliver of wood stuck in your skin",                                    #99  splinter
 "Full of holes yet soaks up water",                                           #100  sponge
 "Metal studs on a rider's boot that keep pace with a horse",                 #101  spurs
 "A small animal that stores nuts up in trees",                                #102  squirrel
 "Where actors perform; opens and closes; the place of kings",                 #103  stage
 "Steps that go up and down, high and low",                                    #104  stairs
 "Adhesive paper for mail that goes around the world",                         #105  stamp
 "Joins paper with metal pins in a single bite",                               #106  stapler
 "Dots of light visible at night, hidden by day",                              #107  stars
 "Scattered in the sky, invisible in sunlight",                                #108  stars
 "The more you take, the more you leave behind",                               #109  steps
 "A word puzzle about four things found in a field",                           #110  suits
 "A shy maiden who blushes in the morning, hidden at night",                  #111  sun
 "Gives light and warmth; its children depend on it",                          #112  sun
 "Shines through windows, on stoves, and on tables",                           #113  sun
 "Appears in the morning, everywhere but invisible",                           #114  sunlight
 "Opens at dawn, shines briefly, then hides again",                            #115  sunrise
 "A bladed weapon that kills and divides the land",                            #116  sword
 "Sharp-edged, settles disputes without a sound",                              #117  sword
 "A unit of pronunciation; one in 'he', two in 'person'",                     #118  syllable
 "Starts and ends with T, has a T inside",                                     #119  teapot
 "Losing it affects everyone around you",                                      #120  temper
 "Steals without being seen, heard, or felt",                                  #121  thief
 "A small metal cap for protecting a finger while sewing",                     #122  thimble
 "A spiky purple flower with a green cloak",                                   #123  thistle
 "A sharp point on a plant; walked into and thrown away",                      #124  thorn
 "Soft and pretty but draws blood if you're careless",                         #125  thorn
 "The loud sound after a lightning flash",                                     #126  thunder
 "A day-of-the-week logic puzzle",                                             #127  thursday
 "The steady in-and-out rhythm of the ocean",                                  #128  tides
 "Neckwear with a charming dimple; two meanings",                             #129  tie
 "The endless force that erodes mountains and kingdoms",                      #130  time
 "Devours all things: birds, stones, kings",                                   #131  time
 "Unmeasured, you don't know it; once gone, you miss it",                     #132  time
 "Flies without wings, brings the morrow",                                     #133  time
 "Builds and destroys, everlasting, cares not about you",                     #134  time
 "Always to come, never seen by anyone",                                       #135  tomorrow
 "A unit of weight that's heavy forward, light backwards",                    #136  ton
 "Held in the mouth, wet, and bites",                                          #137  tongue
 "A teapot shot (tub) to keep the pearlies (teeth) from rotting",             #138  toothpaste
 "Gets wetter the more it dries",                                              #139  towel
 "Loses leaves in winter, regrows in spring; breathes without breath",        #140  tree
 "Mother and father of birds and squirrels",                                   #141  tree
 "Bare in winter, green in summer, gold in between",                           #142  tree
 "Many live on and in it; stands for a very long time",                        #143  tree
 "An animal with a shell on its back, rows with four flippers",               #144  turtle
 "Opens up when the rain comes down",                                          #145  umbrella
 "A string instrument played with a bow",                                      #146  violin
 "You can hear it but not see or touch it",                                    #147  voice
 "A mountain that erupts with fire, ash, and rain that dries the land",       #148  volcano
 "Five letters all found in 'tennis court'",                                   #149  vowels
 "A barrier that surrounds a city but never moves",                            #150  wall
 "A nut with a thick green husk and bitter meat",                              #151  walnut
 "Conflict that grows without physical growth, sown and reaped the same day",  #152  war
 "A part of our body that constantly cycles out and in",                       #153  water
 "Flows and falls, never climbs; smoother than a rhyme",                       #154  water
 "Three states: soothes, caresses, cracks rocks",                              #155  water
 "Created by the moon's pull on the sea; dies on land",                        #156  wave
 "Build it from letters in 'wield', 'blade', 'arrow', 'honor'",        #157  weapon
 "Deep, round, and full of water; horses can't pull it up",                   #158  well
 "Goes in circles but always travels straight ahead",                          #159  wheel
 "A coiled leather strip that cracks with a stinging bite",                    #160  whip
 "An invisible force you can hear but not hold",                               #161  wind
 "Passes before the sun without casting a shadow",                             #162  wind
 "Cries without a voice, flutters without wings, bites without teeth",        #163  wind
 "Flies forever without ever resting",                                         #164  wind
 "Four blades that turn in the wind, always in the same spot",                #165  windmill
 "A glass panel in a wall; an ancient invention",                              #166  window
 "Aged grape drink; sweet when young, valued when old",                       #167  wine
 "The heart of a tree; floats, bleeds sap, sings in the fire",                #168  wood
 "A promise you give before you can keep it",                                  #169  word
 "A state no one wants, yet no one wants to lose",                             #170  work
 "A microorganism that makes bread rise; sinks in water, rises with air",     #171  yeast
]

# ── build hints.json ───────────────────────────────────────────────────
def main():
    with open(SRC) as f:
        data = json.load(f)

    u10, o10 = data["under10"], data["over10"]
    assert len(u10) == len(U10), f"under10 count mismatch: {len(u10)} vs {len(U10)}"
    assert len(o10) == len(O10), f"over10 count mismatch: {len(o10)} vs {len(O10)}"

    hints = {}
    for r, h in zip(u10, U10):
        assert h.strip(), "empty hint"
        ans = r["a"].lower()
        # hard check: answer word must not appear as a word in the hint
        words = set(re.findall(r"[a-z]+", h.lower()))
        assert ans not in words, f"hint contains answer word '{ans}': {h!r}"
        hints[r["q"]] = h

    for r, h in zip(o10, O10):
        assert h.strip(), "empty hint"
        ans = r["a"].lower()
        words = set(re.findall(r"[a-z]+", h.lower()))
        assert ans not in words, f"hint contains answer word '{ans}': {h!r}"
        hints[r["q"]] = h

    with open(OUT, "w") as f:
        json.dump(hints, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Wrote {OUT}: {len(hints)} hints")

if __name__ == "__main__":
    main()
