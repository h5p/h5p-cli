# Configuration
You can optionally add a file in JSON format named `config.json` to your
development environment directory in order to adjust certain settings.

The supported properties currently are:
- _saveFreq : number_: Interval in seconds at which the server tries to save
the current user state. Defaults to 30.

## Example
```
{
  "saveFreq": 15
}
```
