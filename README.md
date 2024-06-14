# Nessie
Is an automated web scraper for downloading Linux torrent files.   
Nessie comes pre-packaged with a basic, simple language to configure scraping and tons of scripts for every distro you want.   
   
## Why?
- To prevent the pain of looking up an OS's official torrent and manually downloading everything.
- To support people looking to host their own Linux distribution mirrors.
- To pull the latest versions of many OSes, all the time.
   
## Shortcomings
- Nessie mainly relies on FOSSTorrent to source torrents. I expect to migrate to official repositories in the future.
- Nessie does not support downloading regular files, only torrent files, meaning it is impossible to download Tiny Core Linux/some Puppy ISOs since they don't provide torrents.
    - I can implement support for downloading regular files manually, but they will be excluded from the torrents folder and downloaded separately.
   
   
~ crit